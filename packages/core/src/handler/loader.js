import extend from '@form-create/utils/lib/extend';
import {byCtx, condition, copyRule, enumerable, getRule, invoke, parseFn, parseJson, toJson} from '../frame/util';
import is, {hasProperty} from '@form-create/utils/lib/type';
import {baseRule} from '../factory/creator';
import RuleContext from '../factory/context';
import mergeProps from '@form-create/utils/lib/mergeprops';
import {nextTick} from 'vue';

export default function useLoader(Handler) {
    extend(Handler.prototype, {
        nextRefresh(fn) {
            const id = this.loadedId;
            nextTick(() => {
                id === this.loadedId && (fn ? fn() : this.refresh());
            });
        },
        parseRule(_rule) {
            const rule = getRule(_rule);

            Object.defineProperties(rule, {
                __origin__: enumerable(_rule, true)
            });

            fullRule(rule);
            this.appendValue(rule);

            [rule, rule['prefix'], rule['suffix']].forEach(item => {
                if (!item) {
                    return;
                }
                this.loadFn(item, rule);
            });
            this.loadCtrl(rule);
            if (rule.update) {
                rule.update = parseFn(rule.update);
            }
            return rule;
        },
        loadFn(item, rule) {
            ['on', 'props', 'deep'].forEach(k => {
                item[k] && this.parseInjectEvent(rule, item[k]);
            });
        },
        loadCtrl(rule) {
            rule.control && rule.control.forEach(ctrl => {
                if (ctrl.handle) {
                    ctrl.handle = parseFn(ctrl.handle)
                }
            })
        },
        syncProp(ctx) {
            const rule = ctx.rule;
            is.trueArray(rule.sync) && mergeProps([{
                on: rule.sync.reduce((pre, prop) => {
                    pre[(typeof prop === 'object' && prop.event) || `update:${prop}`] = (val) => {
                        rule.props[(typeof prop === 'object' && prop.prop) || prop] = val;
                        this.vm.emit('sync', prop, val, rule, this.fapi);
                    }
                    return pre
                }, {})
            }], ctx.computed)
        },
        loadRule() {
            // console.warn('%c load', 'color:blue');
            this.cycleLoad = false;
            this.loading = true;
            if (this.pageEnd) {
                this.bus.$emit('load-start');
            }
            this.deferSyncValue(() => {
                this._loadRule(this.rules);
                this.loading = false;
                if (this.cycleLoad && this.pageEnd) {
                    return this.loadRule();
                }
                this.syncForm();
                if (this.pageEnd) {
                    this.bus.$emit('load-end');
                }
                this.vm.setupState.renderRule();
            });
        },
        loadChildren(children, parent) {
            this.cycleLoad = false;
            this.loading = true;
            this.bus.$emit('load-start');
            this._loadRule(children, parent);
            this.loading = false;
            if (this.cycleLoad) {
                return this.loadRule();
            } else {
                this.syncForm();
                this.bus.$emit('load-end');
            }
            this.$render.clearCache(parent);
        },
        _loadRule(rules, parent) {

            const preIndex = (i) => {
                let pre = rules[i - 1];
                if (!pre || !pre.__fc__) {
                    return i > 0 ? preIndex(i - 1) : -1;
                }
                let index = this.sort.indexOf(pre.__fc__.id);
                return index > -1 ? index : preIndex(i - 1);
            }

            const loadChildren = (children, parent) => {
                if (is.trueArray(children)) {
                    this._loadRule(children, parent);
                }
            };

            const ctxs = rules.map((_rule, index) => {
                if (parent && !is.Object(_rule)) return;
                if (!this.pageEnd && !parent && index >= this.first) return;

                if (_rule.__fc__ && _rule.__fc__.root === rules && this.ctxs[_rule.__fc__.id]) {
                    loadChildren(_rule.__fc__.loadChildrenPending(), _rule.__fc__);
                    return _rule.__fc__;
                }

                let rule = getRule(_rule);

                const isRepeat = () => {
                    return !!(rule.field && this.fieldCtx[rule.field] && this.fieldCtx[rule.field][0] !== _rule.__fc__)
                }

                this.fc.targetFormDriver('loadRule', {rule, api: this.api}, this.fc);
                this.ruleEffect(rule, 'init', {repeat: isRepeat()});

                if (isRepeat()) {
                    this.vm.emit('repeat-field', _rule, this.api);
                }

                let ctx;
                let isCopy = false;
                let isInit = !!_rule.__fc__;
                let defaultValue = rule.value;
                if (isInit) {
                    ctx = _rule.__fc__;
                    defaultValue = ctx.defaultValue;
                    if (ctx.deleted) {
                        if (isCtrl(ctx)) {
                            return;
                        }
                        ctx.update(this);
                    } else {
                        if (!ctx.check(this)) {
                            if (isCtrl(ctx)) {
                                return;
                            }
                            rules[index] = _rule = _rule._clone ? _rule._clone() : parseJson(toJson(_rule));
                            ctx = null;
                            isCopy = true;
                        }
                    }
                }
                if (!ctx) {
                    const rule = this.parseRule(_rule);
                    ctx = new RuleContext(this, rule, defaultValue);
                    this.bindParser(ctx);
                } else {
                    if (ctx.originType !== ctx.rule.type) {
                        ctx.updateType();
                    }
                    this.bindParser(ctx);
                    this.appendValue(ctx.rule);
                    if (ctx.parent && ctx.parent !== parent) {
                        this.rmSubRuleData(ctx);
                    }
                }
                this.parseEmit(ctx);
                this.syncProp(ctx);
                ctx.parent = parent || null;
                ctx.root = rules;
                this.setCtx(ctx);

                if (!isCopy && !isInit) {
                    this.effect(ctx, 'load');
                    this.targetHook(ctx, 'load');
                }

                this.effect(ctx, 'created');

                const _load = ctx.loadChildrenPending()
                ctx.parser.loadChildren === false || loadChildren(_load, ctx);

                if (!parent) {
                    const _preIndex = preIndex(index);
                    if (_preIndex > -1 || !index) {
                        this.sort.splice(_preIndex + 1, 0, ctx.id);
                    } else {
                        this.sort.push(ctx.id);
                    }
                }

                const r = ctx.rule;
                if (!ctx.updated) {
                    ctx.updated = true;
                    if (is.Function(r.update)) {
                        this.bus.$once('load-end', () => {
                            this.refreshUpdate(ctx, r.value, 'init');
                        });
                    }
                    this.effect(ctx, 'loaded');
                }

                // if (ctx.input)
                //     Object.defineProperty(r, 'value', this.valueHandle(ctx));
                if (this.refreshControl(ctx)) this.cycleLoad = true;
                return ctx;
            }).filter(v => !!v);
            if (parent) {
                parent.children = ctxs;
            }
        },
        refreshControl(ctx) {
            return ctx.input && ctx.rule.control && this.useCtrl(ctx);
        },
        useCtrl(ctx) {
            const controls = getCtrl(ctx), validate = [], api = this.api;
            if (!controls.length) return false;

            for (let i = 0; i < controls.length; i++) {
                const control = controls[i], handleFn = control.handle || function (val) {
                    return ((condition[control.condition || '=='] || condition['=='])(val, control.value));
                };
                if (!is.trueArray(control.rule)) continue;
                const data = {
                    ...control,
                    valid: invoke(() => handleFn(ctx.rule.value, api)),
                    ctrl: findCtrl(ctx, control.rule),
                    isHidden: is.String(control.rule[0]),
                };
                if ((data.valid && data.ctrl) || (!data.valid && !data.ctrl && !data.isHidden)) continue;
                validate.push(data);
            }
            if (!validate.length) return false;

            const hideLst = [];
            let flag = false;
            this.deferSyncValue(() => {
                validate.reverse().forEach(({isHidden, valid, rule, prepend, append, child, ctrl, method}) => {
                    if (isHidden) {
                        valid ? ctx.ctrlRule.push({
                            __ctrl: true,
                            children: rule,
                            valid
                        })
                            : (ctrl && ctx.ctrlRule.splice(ctx.ctrlRule.indexOf(ctrl) >>> 0, 1));
                        hideLst[valid ? 'push' : 'unshift'](() => {
                            if (method === 'disabled' || method === 'enabled') {
                                this.api.disabled(!valid, rule);
                            } else if (method === 'display' || method === 'show') {
                                this.api.display(valid, rule);
                            } else if (method === 'required') {
                                rule.forEach(item => {
                                    this.api.setEffect(item, 'required', valid);
                                })
                                if (!valid) {
                                    this.api.clearValidateState(rule);
                                }
                            } else if (method === 'if') {
                                this.api.hidden(!valid, rule);
                            } else {
                                this.api.hidden(!valid, rule);
                            }
                        });
                        return;
                    }
                    if (valid) {
                        flag = true;
                        const ruleCon = {
                            type: 'fragment',
                            native: true,
                            __ctrl: true,
                            children: rule,
                        }
                        ctx.ctrlRule.push(ruleCon);
                        this.bus.$once('load-start', () => {
                            // this.cycleLoad = true;
                            if (prepend) {
                                api.prepend(ruleCon, prepend, child)
                            } else if (append || child) {
                                api.append(ruleCon, append || ctx.id, child)
                            } else {
                                ctx.root.splice(ctx.root.indexOf(ctx.origin) + 1, 0, ruleCon);
                            }
                        });
                    } else {
                        ctx.ctrlRule.splice(ctx.ctrlRule.indexOf(ctrl), 1);
                        const ctrlCtx = byCtx(ctrl);
                        ctrlCtx && ctrlCtx.rm();
                    }
                });
            });
            if (hideLst.length) {
                if (this.loading) {
                    hideLst.length && this.bus.$once('load-end', () => {
                        hideLst.forEach(v => v());
                    });
                } else {
                    hideLst.length && nextTick(() => {
                        hideLst.forEach(v => v());
                    });
                }
            }
            this.vm.emit('control', ctx.origin, this.api);
            this.effect(ctx, 'control');
            return flag;
        },
        reloadRule(rules) {
            return this._reloadRule(rules);
        },
        _reloadRule(rules) {
            // console.warn('%c reload', 'color:red');
            if (!rules) rules = this.rules;

            const ctxs = {...this.ctxs};

            this.clearNextTick();
            this.initData(rules);
            this.fc.rules = rules;

            this.deferSyncValue(() => {
                this.bus.$once('load-end', () => {
                    Object.keys(ctxs).filter(id => this.ctxs[id] === undefined)
                        .forEach(id => this.rmCtx(ctxs[id]));
                    this.$render.clearCacheAll();
                });
                this.reloading = true;
                this.loadRule();
                this.reloading = false;
                this.refresh();
                this.bus.$emit('reloading', this.api);
            });

            this.bus.$off('next-tick', this.nextReload);
            this.bus.$once('next-tick', this.nextReload);
            this.bus.$emit('update', this.api);
        },
        //todo 组件生成全部通过 alias
        refresh() {
            this.vm.setupState.refresh();
        },
    });
}

function fullRule(rule) {
    const def = baseRule();

    Object.keys(def).forEach(k => {
        if (!hasProperty(rule, k)) rule[k] = def[k];
    });
    return rule;
}

function getCtrl(ctx) {
    const control = ctx.rule.control || [];
    if (is.Object(control)) return [control];
    else return control;
}

function findCtrl(ctx, rule) {
    for (let i = 0; i < ctx.ctrlRule.length; i++) {
        const ctrl = ctx.ctrlRule[i];
        if (ctrl.children === rule)
            return ctrl;
    }
}

function isCtrl(ctx) {
    return !!ctx.rule.__ctrl;
}
