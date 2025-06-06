import extend from '@form-create/utils/lib/extend';
import is from '@form-create/utils/lib/type';
import {invoke} from '@form-create/core/src/frame/util';
import toArray from '@form-create/utils/lib/toarray';

function tidyBtnProp(btn, def) {
    if (is.Boolean(btn))
        btn = {show: btn};
    else if (!is.Undef(btn) && !is.Object(btn)) btn = {show: def};
    return btn;
}

export default function extendApi(api, h) {
    return {
        formEl() {
            return h.$manager.form();
        },
        wrapEl(id) {
            const ctx = h.getFieldCtx(id);
            if (!ctx) return;
            return h.vm.refs[ctx.wrapRef];
        },
        validate(callback) {
            return new Promise((resolve, reject) => {
                const forms = api.children;
                const all = [h.$manager.validate()];
                forms.filter(v=>!v.isScope).forEach(v => {
                    all.push(v.validate());
                })
                Promise.all(all).then(() => {
                    resolve(true);
                    callback && callback(true);
                }).catch((e) => {
                    reject(e);
                    callback && callback(e);
                    h.vm.emit('validate-fail', e, {api});
                })
            });
        },
        validateField(field, callback) {
            return new Promise((resolve, reject) => {
                const ctx = h.getFieldCtx(field);
                if (!ctx) return;
                const sub = h.subForm[ctx.id];
                const all = [h.$manager.validateField(ctx.id)];
                toArray(sub).filter(v=>!v.isScope).forEach(v => {
                    all.push(v.validate());
                })
                Promise.all(all).then(() => {
                    resolve(null);
                    callback && callback(null);
                }).catch((e) => {
                    reject(e);
                    callback && callback(e);
                    h.vm.emit('validate-field-fail', e, {field, api});
                })
            });
        },
        clearValidateState(fields, clearSub = true) {
            api.helper.tidyFields(fields).forEach(field => {
                if (clearSub) this.clearSubValidateState(field);
                h.getCtxs(field).forEach(ctx => {
                    h.$manager.clearValidateState(ctx);
                });
            });
        },
        clearSubValidateState(fields) {
            api.helper.tidyFields(fields).forEach(field => {
                h.getCtxs(field).forEach(ctx => {
                    const subForm = h.subForm[ctx.id];
                    if (!subForm) return;
                    if (Array.isArray(subForm)) {
                        subForm.forEach(form => {
                            form.clearValidateState();
                        })
                    } else if (subForm) {
                        subForm.clearValidateState();
                    }
                });
            })
        },
        btn: {
            loading: (loading = true) => {
                api.submitBtnProps({loading: !!loading});
            },
            disabled: (disabled = true) => {
                api.submitBtnProps({disabled: !!disabled});
            },
            show: (isShow = true) => {
                api.submitBtnProps({show: !!isShow});
            }
        },
        resetBtn: {
            loading: (loading = true) => {
                api.resetBtnProps({loading: !!loading});
            },
            disabled: (disabled = true) => {
                api.resetBtnProps({disabled: !!disabled});
            },
            show: (isShow = true) => {
                api.resetBtnProps({show: !!isShow});
            }
        },
        submitBtnProps: (props = {}) => {
            let btn = tidyBtnProp(h.options.submitBtn, true);
            extend(btn, props);
            h.options.submitBtn = btn;
            api.refreshOptions();
        },
        resetBtnProps: (props = {}) => {
            let btn = tidyBtnProp(h.options.resetBtn, false);
            extend(btn, props);
            h.options.resetBtn = btn;
            api.refreshOptions();
        },
        submit(successFn, failFn) {
            return new Promise((resolve, reject) => {
                const promise = h.options.validateOnSubmit === false ? Promise.resolve() : api.validate();
                promise.then(() => {
                    let formData = api.formData();
                    h.beforeSubmit(formData).then(() => {
                        is.Function(successFn) && invoke(() => successFn(formData, api));
                        is.Function(h.options.onSubmit) && invoke(() => h.options.onSubmit(formData, api));
                        h.vm.emit('submit', formData, api);
                        resolve(formData);
                    }).catch((e) => {})
                }).catch((...args) => {
                    is.Function(failFn) && invoke(() => failFn(api, ...args));
                    reject(...args)
                })
            });
        },
    };
}
