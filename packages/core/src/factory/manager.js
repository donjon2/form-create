import mergeProps from '@form-create/utils/lib/mergeprops';
import unique from '@form-create/utils/lib/unique';
import extend from '@form-create/utils/lib/extend';
import {invoke} from '../frame/util';

export function createManager(proto) {
    class CustomManager extends Manager {
    }

    Object.assign(CustomManager.prototype, proto);
    return CustomManager;
}

export default function Manager(handler) {
    extend(this, {
        $handle: handler,
        vm: handler.vm,
        options: {},
        ref: 'fcForm',
        mergeOptionsRule: {
            normal: ['form', 'row', 'info', 'submitBtn', 'resetBtn']
        }
    });
    this.updateKey();
    this.init();
}

extend(Manager.prototype, {
    __init() {
        this.$render = this.$handle.$render;
        this.$r = (...args) => this.$render.renderRule(...args);
    },
    updateKey() {
        this.key = unique();
    },
    //TODO interface
    init() {
    },
    update() {
    },
    beforeRender() {
    },
    form() {
        return this.vm.refs[this.ref];
    },
    adapterValidate(validate, validator) {
        validate.validator = (rule, value, callback) => {
            return validator(value, callback);
        }
        return validate;
    },
    getSlot(name){
        const _fn = (vm) => {
            if (vm) {
                let slot = vm.slots[name];
                if (slot) {
                    return slot;
                }
                return _fn(vm.setupState.parent);
            }
            return undefined;
        }
        return _fn(this.vm);
    },
    mergeOptions(args, opt) {
        return mergeProps(args.map(v => this.tidyOptions(v)), opt, this.mergeOptionsRule);
    },
    updateOptions(options) {
        this.$handle.fc.targetFormDriver('updateOptions', options, {handle: this.$handle, api: this.$handle.api})
        this.options = this.mergeOptions([options], this.getDefaultOptions());
        this.update();
    },
    tidyOptions(options) {
        return options;
    },
    tidyRule(ctx) {
    },
    mergeProp(ctx) {
    },
    getDefaultOptions() {
        return {};
    },
    render(children) {
    }
})
