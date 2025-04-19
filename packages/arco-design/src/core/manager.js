import getConfig from './config';
import mergeProps from '@form-create/utils/lib/mergeprops';
import is, {hasProperty} from '@form-create/utils/lib/type';
import extend from '@form-create/utils/lib/extend';

function tidy(props, name) {
    if (!hasProperty(props, name)) return;
    if (is.String(props[name])) {
        props[name] = {[name]: props[name], show: true};
    }
}

function isFalse(val) {
    return val === false;
}

function tidyBool(opt, name) {
    if (hasProperty(opt, name) && !is.Object(opt[name])) {
        opt[name] = {show: !!opt[name]};
    }
}

function tidyRule(rule) {
    const _rule = {...rule};
    delete _rule.children;
    return _rule;
}

export default {
    validate() {
        return new Promise((resolve, reject) => {
            const form = this.form();
            if (form) {
                form.validate((err) => {
                    err === undefined ? resolve(undefined) : reject(err);
                });
            } else {
                resolve(undefined);
            }
        })
    },
    validateField(field) {
        return new Promise((resolve, reject) => {
            const form = this.form();
            if (form) {
                form.validateField(field, (err) => {
                    err === undefined ? resolve(undefined) : reject(err);
                });
            } else {
                resolve(undefined);
            }
        })
    },
    clearValidateState(ctx) {
        const form = this.form();
        return form && form.setFields({
            [ctx.id]: {
                status: 'success',
                message: ''
            }
        });
    },
    tidyOptions(options) {
        ['submitBtn', 'resetBtn', 'row', 'info', 'wrap', 'col', 'title'].forEach(name => {
            tidyBool(options, name);
        })
        return options;
    },
    tidyRule({prop}) {
        tidy(prop, 'title');
        tidy(prop, 'info');
        return prop;
    },
    mergeProp(ctx) {
        const def = {
            info: {
                type: 'popover',
                position: 'tl',
                icon: 'icon-info-circle'
            },
            title: {},
            col: {span: 24},
            wrap: {},
        };
        ['info', 'wrap', 'col', 'title'].forEach(name => {
            ctx.prop[name] = mergeProps([this.options[name] || {}, ctx.prop[name] || {}], def[name]);
        });
    },
    getDefaultOptions() {
        return getConfig();
    },
    adapterValidate(validate, validator) {
        validate.validator = validator;
        return validate;
    },
    update() {
        const form = this.options.form;
        this.rule = {
            props: {...form},
            on: {
                submit: (e) => {
                    e.preventDefault();
                }
            },
            style: form.style,
            type: 'form',
        };
    },
    beforeRender() {
        const {key, ref, $handle} = this;
        const form = this.options.form;
        extend(this.rule, {key, ref, class: [form.className, form.class, 'form-create', this.$handle.preview ? 'is-preview' : '']});
        extend(this.rule.props, {
            model: $handle.formData,
        });
    },
    render(children) {
        if (children.slotLen() && !this.$handle.preview) {
            children.setSlot(undefined, () => this.makeFormBtn());
        }
        return this.$r(this.rule, isFalse(this.options.row.show) ? children.getSlots() : [this.makeRow(children)]);
    },
    makeWrap(ctx, children) {
        const rule = ctx.prop;
        const uni = `${this.key}${ctx.key}`;
        const col = rule.col;
        const isTitle = this.isTitle(rule) && rule.wrap.title !== false;
        const {layout, col: _col} = this.rule.props;
        delete rule.wrap.title;
        const item = isFalse(rule.wrap.show) ? children : this.$r(mergeProps([rule.wrap, {
            props: {
                ...tidyRule(rule.wrap || {}),
                field: ctx.id,
                rules: rule.validate,
                ...(layout !== 'horizontal' ? {labelColProps: {}, wrapperColProps: {}} : {})
            },
            class: this.$render.mergeClass(rule.className, 'fc-form-item'),
            key: `${uni}fi`,
            ref: ctx.wrapRef,
            type: 'formItem',
        }]), {default: () => children, ...(isTitle ? {label: () => this.makeInfo(rule, uni, ctx)} : {})});
        return (layout === 'inline' || isFalse(_col) || isFalse(col.show)) ? item : this.makeCol(rule, uni, [item]);
    },
    isTitle(rule) {
        if (this.options.form.title === false) return false;
        const title = rule.title;
        return !((!title.title && !title.native) || isFalse(title.show));
    },
    makeInfo(rule, uni, ctx) {
        const titleProp = {...rule.title};
        const infoProp = {...rule.info};
        if (this.options.form.title === false) return false;
        if ((!titleProp.title && !titleProp.native) || isFalse(titleProp.show)) return;
        const titleSlot = this.getSlot('title');
        const children = [titleSlot ? titleSlot({
            title: ctx.refRule?.__$title?.value,
            rule: ctx.rule,
            options: this.options
        }) : ctx.refRule?.__$title?.value];

        if (!isFalse(infoProp.show) && (infoProp.info || infoProp.native) && !isFalse(infoProp.icon)) {
            const prop = {
                type: infoProp.type || 'popover',
                props: tidyRule(infoProp),
                key: `${uni}pop`,
            };

            delete prop.props.icon;
            delete prop.props.show;
            delete prop.props.info;
            delete prop.props.align;
            delete prop.props.native;

            const field = 'content';
            if (infoProp.info && !hasProperty(prop.props, field)) {
                prop.props[field] = ctx.refRule?.__$info?.value;
            }
            children[infoProp.align !== 'left' ? 'unshift' : 'push'](this.$r(mergeProps([infoProp, prop]), {
                [titleProp.slot || 'default']: () => this.$r({
                    type: infoProp.icon === true ? 'icon-info-circle' : (infoProp.icon || ''),
                    props: {type: infoProp.icon === true ? 'icon-info-circle' : infoProp.icon},
                    key: `${uni}i`
                })
            }))
        }

        const _prop = mergeProps([titleProp, {
            props: tidyRule(titleProp),
            key: `${uni}tit`,
            class: 'fc-form-title',
            type: titleProp.type || 'span',
        }]);

        delete _prop.props.show;
        delete _prop.props.title;
        delete _prop.props.native;

        return this.$r(_prop, children);
    },
    makeCol(rule, uni, children) {
        const col = rule.col;
        return this.$r({
            class: this.$render.mergeClass(col.class, 'fc-form-col'),
            type: 'col',
            props: col || {span: 24},
            key: `${uni}col`
        }, children);
    },
    makeRow(children) {
        const row = this.options.row || {};
        return this.$r({
            type: 'row',
            props: row,
            class: this.$render.mergeClass(row.class, 'fc-form-row'),
            key: `${this.key}row`
        }, children)
    },
    makeFormBtn() {
        let vn = [];
        if (!isFalse(this.options.submitBtn.show)) {
            vn.push(this.makeSubmitBtn())
        }
        if (!isFalse(this.options.resetBtn.show)) {
            vn.push(this.makeResetBtn())
        }
        if (!vn.length) {
            return;
        }
        let {labelColProps, wrapperColProps, layout} = this.rule.props;
        if (layout !== 'horizontal') {
            labelColProps = wrapperColProps = {};
        }
        const item = this.$r({
            type: 'formItem',
            class: 'fc-form-item',
            key: `${this.key}fb`,
            props: {
                labelColProps,
                wrapperColProps,
                label: ' ', colon: false
            }
        }, vn);

        return layout === 'inline'
            ? item
            : this.$r({
                type: 'col',
                class: 'fc-form-col fc-form-footer',
                props: {span: 24},
                key: `${this.key}fc`
            }, [item]);
    },
    makeResetBtn() {
        const resetBtn = {...this.options.resetBtn};
        const innerText = resetBtn.innerText || this.$handle.api.t('reset') || '重置';
        delete resetBtn.innerText;
        delete resetBtn.click;
        delete resetBtn.col;
        delete resetBtn.show;
        return this.$r({
            type: 'button',
            props: resetBtn,
            class: 'fc-reset-btn',
            style: {width: resetBtn.width, marginLeft: '10px'},
            on: {
                click: () => {
                    const fApi = this.$handle.api;
                    this.options.resetBtn.click
                        ? this.options.resetBtn.click(fApi)
                        : fApi.resetFields();
                }
            },
            key: `${this.key}b2`,
        }, [innerText]);
    },
    makeSubmitBtn() {
        const submitBtn = {...this.options.submitBtn};
        const innerText = submitBtn.innerText || this.$handle.api.t('submit') || '提交';
        delete submitBtn.innerText;
        delete submitBtn.click;
        delete submitBtn.col;
        delete submitBtn.show;
        return this.$r({
            type: 'button',
            props: submitBtn,
            class: 'fc-submit-btn',
            style: {width: submitBtn.width},
            on: {
                click: () => {
                    const fApi = this.$handle.api;
                    this.options.submitBtn.click
                        ? this.options.submitBtn.click(fApi)
                        : fApi.submit().catch(() => {
                        });
                }
            },
            key: `${this.key}b1`,
        }, [innerText]);
    }
}
