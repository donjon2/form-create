import $FormCreate from '../components/formCreate';
import {computed, createApp, h, nextTick, reactive, ref, watch} from 'vue';
import makerFactory from '../factory/maker';
import Handle from '../handler';
import fetch from './fetch';
import {creatorFactory, mergeRule} from '..';
import BaseParser from '../factory/parser';
import {copyRule, copyRules, deepGet, invoke, mergeGlobal, parseFn, parseJson, setPrototypeOf, toJson} from './util';
import fragment from '../components/fragment';
import is, {hasProperty} from '@form-create/utils/lib/type';
import toCase from '@form-create/utils/lib/tocase';
import extend, {copy} from '@form-create/utils/lib/extend';
import {CreateNodeFactory} from '../factory/node';
import {createManager} from '../factory/manager';
import {arrayAttrs, keyAttrs, normalAttrs} from './attrs';
import {appendProto} from '../factory/creator';
import $provider from './provider';
import {deepCopy} from '@form-create/utils/lib/deepextend';
import Mitt from '@form-create/utils/lib/mitt';
import html from '../parser/html';
import uniqueId from '@form-create/utils/lib/unique';
import {cookieDriver, localStorageDriver, sessionStorageDriver} from './dataDriver';
import debounce from '@form-create/utils/lib/debounce';
import {deepSet} from '@form-create/utils';
import baseLanguage from './language';

function parseProp(name, id) {
    let prop;
    if (arguments.length === 2) {
        prop = arguments[1];
        id = prop[name];
    } else {
        prop = arguments[2];
    }
    return {id, prop};
}

function nameProp() {
    return parseProp('name', ...arguments);
}

function exportAttrs(attrs) {
    const key = attrs.key || [];
    const array = attrs.array || [];
    const normal = attrs.normal || [];
    keyAttrs.push(...key);
    arrayAttrs.push(...array);
    normalAttrs.push(...normal);

    appendProto([...key, ...array, ...normal]);
}

let id = 1;
const instance = {};
const defValueTag = Symbol('defValue');

//todo 表单嵌套
export default function FormCreateFactory(config) {

    const components = {
        [fragment.name]: fragment
    };
    const parsers = {};
    const directives = {};
    const modelFields = {};
    const drivers = {};
    const useApps = [];
    const listener = [];
    const extendApiFn = [
        config.extendApi
    ];
    const providers = {
        ...$provider
    };
    const maker = makerFactory();
    let globalConfig = {global: {}};
    const isMobile = config.isMobile === true;
    const loadData = reactive({
        $mobile: isMobile,
    });
    const CreateNode = CreateNodeFactory();
    const formulas = {};
    const prototype = {};

    exportAttrs(config.attrs || {});

    function getApi(name) {
        const val = instance[name];
        if (Array.isArray(val)) {
            return val.map(v => {
                return v.api();
            });
        } else if (val) {
            return val.api();
        }
    }

    function useApp(fn) {
        useApps.push(fn);
    }

    function directive() {
        const data = nameProp(...arguments);
        if (data.id && data.prop) directives[data.id] = data.prop;
    }

    function register() {
        const data = nameProp(...arguments);
        if (data.id && data.prop) providers[data.id] = is.Function(data.prop) ? data.prop : {
            ...data.prop,
            name: data.id
        };
    }

    function componentAlias(alias) {
        CreateNode.use(alias);
    }

    function parser() {
        const data = nameProp(...arguments);
        if (!data.id || !data.prop) return BaseParser;
        const name = toCase(data.id);
        const parser = data.prop;
        const base = parser.merge === true ? parsers[name] : undefined;
        parsers[name] = setPrototypeOf(parser, base || BaseParser);
        maker[name] = creatorFactory(name);
        parser.maker && extend(maker, parser.maker);
    }

    function component(id, component) {
        let name;
        if (is.String(id)) {
            name = id;
            if (component === undefined) {
                return components[name];
            }
        } else {
            name = id.displayName || id.name;
            component = id;
        }
        if (!name || !component) return;
        const nameAlias = toCase(name);
        components[name] = component;
        components[nameAlias] = component;
        delete CreateNode.aliasMap[name];
        delete CreateNode.aliasMap[nameAlias];
        delete parsers[name];
        delete parsers[nameAlias];
        if (component.formCreateParser) parser(name, component.formCreateParser);
    }

    function $form() {
        return $FormCreate(FormCreate, components, directives);
    }

    function createFormApp(rule, option) {
        const Type = $form();
        return createApp({
            data() {
                return reactive({
                    rule, option
                });
            },
            render() {
                return h(Type, {ref: 'fc', ...this.$data});
            }
        });
    }

    function $vnode() {
        return fragment;
    }

    //todo 检查回调函数作用域
    function use(fn, opt) {
        if (is.Function(fn.install)) fn.install(create, opt);
        else if (is.Function(fn)) fn(create, opt);
        return this;
    }

    function create(rules, option) {
        let app = createFormApp(rules, option || {});
        useApps.forEach(v => {
            invoke(() => v(create, app));
        })
        const div = document.createElement('div');
        (option?.el || document.body).appendChild(div);
        const vm = app.mount(div);
        return vm.$refs.fc.fapi;
    }

    setPrototypeOf(create, prototype);

    function factory(inherit) {
        let _config = {...config};
        if (inherit) {
            _config.inherit = {
                components,
                parsers,
                directives,
                modelFields,
                providers,
                useApps,
                maker,
                formulas,
                loadData
            }
        } else {
            delete _config.inherit;
        }
        return FormCreateFactory(_config);
    }

    function setModelField(name, field) {
        modelFields[name] = field;
    }

    function setFormula(name, fn) {
        formulas[name] = fn;
    }

    function setDriver(name, driver) {
        const parent = drivers[name] || {};
        const parsers = parent.parsers || {};
        if (driver.parsers) {
            Object.keys(driver.parsers).forEach(k => {
                parsers[k] = setPrototypeOf(driver.parsers[k], BaseParser);
            });
        }
        driver.name = name;
        drivers[name] = {...parent, ...driver, parsers};
    }

    function refreshData(id) {
        if (id) {
            Object.keys(instance).forEach(v => {
                const apis = Array.isArray(instance[v]) ? instance[v] : [instance[v]];
                apis.forEach(that => {
                    that.bus.$emit('$loadData.' + id);
                })
            })
        }
    }

    function setData(id, data) {
        deepSet(loadData, id, data);
        refreshData(id);
    }

    function setDataDriver(id, data) {
        const callback = (...args) => {
            return invoke(() => data(...args));
        }
        callback._driver = true;
        setData(id, callback);
    }

    function getData(id, def) {
        const split = (id || '').split('.');
        id = split.shift();
        const field = split.join('.');
        if (!hasProperty(loadData, id)) {
            loadData[id] = defValueTag;
        }
        if (loadData[id] !== defValueTag) {
            let val = loadData[id];
            if (val && val._driver) {
                val = val(field);
            } else if (split.length) {
                val = deepGet(val, split);
            }
            return (val == null || val === '') ? def : val;
        } else {
            return def;
        }
    }

    function extendApi(fn) {
        extendApiFn.push(fn);
    }

    function removeData(id) {
        delete loadData[id];
        refreshData(id);
    }

    function on(name, callback) {
        listener.push({name, callback});
    }

    function FormCreate(vm) {
        extend(this, {
            id: id++,
            create,
            vm,
            manager: createManager(config.manager),
            parsers,
            providers,
            modelFields,
            formulas,
            isMobile,
            rules: vm.props.rule,
            name: vm.props.name || uniqueId(),
            inFor: vm.props.inFor,
            prop: {
                components,
                directives,
            },
            get: null,
            drivers,
            renderDriver: null,
            refreshData,
            loadData,
            CreateNode,
            bus: new Mitt(),
            unwatch: [],
            options: ref({}),
            extendApiFn,
            fetchCache: new WeakMap(),
            tmpData: reactive({}),
        })
        listener.forEach(item => {
            this.bus.$on(item.name, item.callback);
        });
        nextTick(() => {
            watch(this.options, () => {
                this.$handle.$manager.updateOptions(this.options.value);
                this.api().refresh();
            }, {deep: true})
        });
        extend(vm.appContext.components, components);
        extend(vm.appContext.directives, directives);
        this.$handle = new Handle(this)
        if (this.name) {
            if (this.inFor) {
                if (!instance[this.name]) instance[this.name] = [];
                instance[this.name].push(this);
            } else {
                instance[this.name] = this;
            }
        }
    }

    FormCreate.isMobile = isMobile;

    extend(FormCreate.prototype, {
        init() {
            if (this.isSub()) {
                this.unwatch.push(watch(() => this.vm.setupState.parent.setupState.fc.options.value, () => {
                    this.initOptions();
                    this.$handle.api.refresh();
                }, {deep: true}));
            }
            if (this.vm.props.driver) {
                this.renderDriver = typeof this.vm.props.driver === 'object' ? this.vm.props.driver : this.drivers[this.vm.props.driver];
            }
            if (!this.renderDriver && this.vm.setupState.parent) {
                this.renderDriver = this.vm.setupState.parent.setupState.fc.renderDriver;
            }
            if (!this.renderDriver) {
                this.renderDriver = this.drivers.default;
            }
            this.initOptions();
            this.$handle.init();
        },
        targetFormDriver(method, ...args) {
            if (this.renderDriver && this.renderDriver[method]) {
                return invoke(() => this.renderDriver[method](...args));
            }
        },
        t(id, params, get) {
            let value = get ? get('$t.' + id) : this.globalLanguageDriver(id);
            if (value == null) {
                value = '';
            }
            if (value && params) {
                Object.keys(params).forEach(param => {
                    const regex = new RegExp(`{${param}}`, 'g');
                    value = value.replace(regex, params[param]);
                });
            }
            return value;
        },
        globalDataDriver(id) {
            let split = id.split('.');
            const key = split.shift();
            const option = this.options.value.globalData && this.options.value.globalData[key];
            if (option) {
                if (option.type === 'static') {
                    return deepGet(option.data, split);
                } else {
                    let val;
                    const res = this.fetchCache.get(option);
                    if (res) {
                        if (res.status) {
                            val = deepGet(res.data, split);
                        }
                        if (!res.loading) {
                            return val;
                        }
                        res.loading = false;
                        this.fetchCache.set(option, res);
                    } else {
                        this.fetchCache.set(option, {status: false});
                    }
                    const reload = debounce(() => {
                        unwatch();
                        const res = this.fetchCache.get(option);
                        if ((this.options.value.globalData && Object.values(this.options.value.globalData).indexOf(option) !== -1)) {
                            if (res) {
                                res.loading = true;
                                this.fetchCache.set(option, res);
                            }
                            this.bus.$emit('$loadData.$globalData.' + key);
                        } else {
                            this.fetchCache.delete(option);
                        }
                    }, option.wait || 600)

                    const _emit = (data) => {
                        this.fetchCache.set(option, {status: true, data});
                        this.bus.$emit('$loadData.$globalData.' + key);
                    };

                    const callback = (get, change) => {
                        if (change && option.watch === false) {
                            return unwatch();
                        }
                        if (change) {
                            reload();
                            return;
                        }
                        const options = this.$handle.loadFetchVar(copy(option), get);
                        this.$handle.api.fetch(options).then(res => {
                            _emit(res);
                        }).catch(e => {
                            _emit(null);
                        });
                    };
                    const unwatch = this.watchLoadData(callback);
                    this.unwatch.push(unwatch);
                    return val;
                }
            }
        },
        getLocale() {
            let locale = this.vm.setupState.top.props.locale;
            if (locale && typeof locale === 'object') {
                return locale.name;
            }
            if (typeof locale === 'string') {
                return locale;
            }
            return 'zh-cn';
        },
        globalLanguageDriver(id) {
            let locale = this.vm.setupState.top.props.locale;
            let value = undefined;
            if (locale && typeof locale === 'object') {
                value = deepGet(locale, id);
            }
            if (value == null) {
                const language = this.options.value.language || {};
                const locale = this.getLocale();
                value = deepGet(language[locale] || {}, id);
                if (value == null) {
                    value = deepGet(baseLanguage[locale] || {}, id);
                }
            }
            return value;
        },
        globalVarDriver(id) {
            let split = id.split('.');
            const key = split.shift();
            const option = this.options.value.globalVariable && this.options.value.globalVariable[key];
            if (option) {
                const handle = is.Function(option) ? option : parseFn(option.handle);
                if (handle) {
                    let val;
                    const unwatch = this.watchLoadData((get, flag) => {
                        if (flag) {
                            this.bus.$emit('$loadData.$var.' + key);
                            unwatch();
                        } else {
                            val = handle(get, this.$handle.api);
                        }
                    });
                    this.unwatch.push(unwatch);
                    return deepGet(val, split);
                }
            }
        },
        setData(id, data, isGlobal) {
            if (!isGlobal) {
                deepSet(this.vm.setupState.top.setupState.fc.tmpData, id, data);
                this.bus.$emit('$loadData.' + id);
            } else {
                setData(id, data);
            }
        },
        getLoadData(id, def) {
            let val = null;
            if (id != null) {
                let split = id.split('.');
                const key = split.shift();
                if (key === '$topForm') {
                    val = this.$handle.api.top.formData(true);
                } else if (key === '$scopeForm') {
                    val = this.$handle.api.scope.formData(true);
                } else if (key === '$form') {
                    val = this.$handle.api.formData(true);
                } else if (key === '$options') {
                    val = this.options.value;
                } else if (key === '$globalData') {
                    val = this.globalDataDriver(split.join('.'));
                    split = [];
                } else if (key === '$var') {
                    val = this.globalVarDriver(split.join('.'));
                    split = [];
                } else if (key === '$locale') {
                    val = this.getLocale();
                    split = [];
                } else if (key === '$t') {
                    val = this.globalLanguageDriver(split.join('.'));
                    split = [];
                } else if (key === '$preview') {
                    return this.$handle.preview;
                } else {
                    const tmpData = this.vm.setupState.top.setupState.fc.tmpData;
                    if (!hasProperty(tmpData, key)) {
                        tmpData[key] = defValueTag;
                    }
                    val = tmpData[key] !== defValueTag ? deepGet(tmpData, id) : getData(id);
                    split = [];
                }
                if (val && split.length) {
                    val = deepGet(val, split);
                }
            }
            return (val == null || val === '') ? def : val;
        },
        watchLoadData(fn, wait) {
            let unwatch = {};

            const run = (flag) => {
                if (!this.get) {
                    this.get = get;
                }
                invoke(() => {
                    fn(get, flag);
                });
                if (this.get === get) {
                    this.get = undefined;
                }
            };

            const get = (id, def) => {
                let getValue;
                if (typeof id === 'object') {
                    getValue = id.getValue;
                    id = id.id;
                }
                if (unwatch[id]) {
                    return unwatch[id].val;
                }
                const data = computed(() => {
                    return getValue ? getValue() : this.getLoadData(id, def);
                })
                const split = id.split('.');
                const key = split.shift();
                const key2 = split.shift() || '';
                const callback = debounce(() => {
                    const temp = getValue ? getValue() : this.getLoadData(id, def);
                    if (!unwatch[id]) {
                        return;
                    } else if (((temp instanceof Function || is.Object(temp) || Array.isArray(temp)) && temp === unwatch[id].val) || JSON.stringify(temp) !== JSON.stringify(unwatch[id].val)) {
                        unwatch[id].val = temp;
                        run(true);
                    }
                }, wait || 0);
                const un = watch(data, (n) => {
                    callback();
                });
                this.bus.$on('$loadData.' + key, callback);
                if (key2) {
                    this.bus.$on('$loadData.' + key + '.' + key2, callback);
                }
                unwatch[id] = {
                    fn: (() => {
                        this.bus.$off('$loadData.' + key, callback);
                        if (key2) {
                            this.bus.$off('$loadData.' + key + '.' + key2, callback);
                        }
                        un();
                    }),
                    val: data.value,
                }
                return data.value;
            }
            run(false);
            const un = () => {
                Object.keys(unwatch).forEach(k => unwatch[k].fn());
                unwatch = {};
            }
            this.unwatch.push(un);
            return un;
        },
        isSub() {
            return this.vm.setupState.parent && this.vm.props.extendOption;
        },
        initOptions() {
            this.options.value = {};
            let options = {
                formData: {},
                submitBtn: {},
                resetBtn: {},
                globalEvent: {},
                globalData: {}, ...deepCopy(globalConfig)
            };
            if (this.isSub()) {
                options = this.mergeOptions(options, this.vm.setupState.parent.setupState.fc.options.value || {}, true);
            }
            options = this.mergeOptions(options, this.vm.props.option);
            this.updateOptions(options);
        },
        mergeOptions(target, opt, parent) {
            opt = {...opt || {}};
            parent && ['page', 'onSubmit', 'onReset', 'onCreated', 'onChange', 'onMounted', 'mounted', 'onReload', 'reload', 'formData', 'el', 'globalClass', 'style'].forEach((n) => {
                delete opt[n];
            });
            if (opt.global) {
                target.global = mergeGlobal(target.global, opt.global);
                delete opt.global;
            }
            this.$handle.$manager.mergeOptions([opt], target);
            return target;
        },
        updateOptions(options) {
            this.options.value = this.mergeOptions(this.options.value, options);
            this.$handle.$manager.updateOptions(this.options.value);
            this.bus.$emit('$loadData.$options');
        },
        api() {
            return this.$handle.api;
        },
        render() {
            return this.$handle.render();
        },
        mounted() {
            this.$handle.mounted();
        },
        unmount() {
            if (this.name) {
                if (this.inFor) {
                    const idx = instance[this.name].indexOf(this);
                    instance[this.name].splice(idx, 1);
                } else {
                    delete instance[this.name];
                }
            }
            listener.forEach(item => {
                this.bus.$off(item.name, item.callback);
            });
            this.tmpData = {};
            this.unwatch.forEach(fn => fn());
            this.unwatch = [];
            this.$handle.reloadRule([]);
        },
        updated() {
            this.$handle.bindNextTick(() => this.bus.$emit('next-tick', this.$handle.api));
        }
    })


    function useAttr(formCreate) {
        extend(formCreate, {
            version: config.version,
            ui: config.ui,
            isMobile,
            extendApi,
            getData,
            setDataDriver,
            setData,
            removeData,
            refreshData,
            maker,
            component,
            directive,
            setModelField,
            setFormula,
            setDriver,
            register,
            $vnode,
            parser,
            use,
            factory,
            componentAlias,
            copyRule,
            copyRules,
            mergeRule,
            fetch,
            $form,
            parseFn,
            parseJson,
            toJson,
            useApp,
            getApi,
            on,
        });
    }

    function useStatic(formCreate) {
        extend(formCreate, {
            create,
            install(app, options) {
                globalConfig = {...globalConfig, ...(options || {})}
                const key = '_installedFormCreate_' + config.ui;
                if (app[key] === true) return;
                app[key] = true;

                const $formCreate = function (rules, opt = {}) {
                    return create(rules, opt, this);
                };

                useAttr($formCreate);

                app.config.globalProperties.$formCreate = $formCreate;
                const $component = $form();
                app.component($component.name, $component);
                useApps.forEach(v => {
                    invoke(() => v(formCreate, app));
                })
            }
        })
    }

    useAttr(prototype);
    useStatic(prototype);

    setDataDriver('$cookie', cookieDriver);
    setDataDriver('$localStorage', localStorageDriver);
    setDataDriver('$sessionStorage', sessionStorageDriver);

    CreateNode.use({fragment: 'fcFragment'});

    config.install && create.use(config);

    useApp((_, app) => {
        app.mixin({
            props: ['formCreateInject'],
        })
    })

    parser(html);

    if (config.inherit) {
        const inherit = config.inherit;
        inherit.components && extend(components, inherit.components);
        inherit.parsers && extend(parsers, inherit.parsers);
        inherit.directives && extend(directives, inherit.directives);
        inherit.modelFields && extend(modelFields, inherit.modelFields);
        inherit.providers && extend(providers, inherit.providers);
        inherit.useApps && extend(useApps, inherit.useApps);
        inherit.maker && extend(maker, inherit.maker);
        inherit.loadData && extend(loadData, inherit.loadData);
        inherit.formulas && extend(formulas, inherit.formulas);
    }

    const FcComponent = $form();
    setPrototypeOf(FcComponent, prototype);
    Object.defineProperties(FcComponent, {
        fetch: {
            get() {
                return prototype.fetch;
            },
            set(val) {
                prototype.fetch = val;
            }
        }
    })

    FcComponent.util = prototype;

    return FcComponent;
}
