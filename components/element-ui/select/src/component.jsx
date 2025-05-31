import {defineComponent, toRef, watch} from 'vue';
import getSlot from '@form-create/utils/lib/slot';
import is, {hasProperty} from '@form-create/utils/lib/type';

const NAME = 'fcSelect';

export default defineComponent({
    name: NAME,
    inheritAttrs: false,
    props: {
        formCreateInject: Object,
        modelValue: {
            type: [Array, String, Number, Boolean, Object],
            default: undefined
        },
        type: String,
        labelField: String,
        valueField: String,
        defaultFirst: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue', 'fc.el'],
    setup(props, {emit}) {
        const options = toRef(props.formCreateInject, 'options', []);
        const value = toRef(props, 'modelValue');
        const labelField = toRef(props, 'labelField', 'label');
        const valueField = toRef(props, 'valueField', 'value');
        
        const _options = () => {
            return Array.isArray(options.value) ? options.value : []
        }

        // 监听 options 变化，如果启用了 defaultFirst 且当前没有选中值，则选中第一个选项
        watch(options, (newOptions) => {
            if (props.defaultFirst && value.value === undefined && newOptions?.length) {
                const firstOption = newOptions[0];
                const firstValue = hasProperty(firstOption, 'options') 
                    ? firstOption.options?.[0]?.[valueField.value]
                    : firstOption[valueField.value];
                
                if (firstValue !== undefined) {
                    emit('update:modelValue', firstValue);
                }
            }
        }, {immediate: true});

        return {
            options: _options,
            value,
            labelField,
            valueField
        }
    },
    render() {
        const makeOption = (props, index, labelField, valueField) => {
            return <ElOption value={props[valueField]} label={props[labelField]} key={'' + index + '-' + props[valueField]}/>;
        }
        const makeOptionGroup = (props, index, labelField, valueField) => {
            return <ElOptionGroup label={props[labelField]}
                key={'' + index + '-' + props[labelField]}>
                {is.trueArray(props.options) && props.options.map((v, index) => {
                    return makeOption(v, index, labelField, valueField);
                })}
            </ElOptionGroup>;
        }
        const options = this.options();
        return <ElSelect {...this.$attrs} modelValue={this.value}
            onUpdate:modelValue={(v) => this.$emit('update:modelValue', v)}
            v-slots={getSlot(this.$slots, ['default'])} ref="el">{options.map((props, index) => {
                return hasProperty(props || '', 'options') ? makeOptionGroup(props, index, this.labelField, this.valueField) : makeOption(props, index, this.labelField, this.valueField);
            })}{this.$slots.default?.()}</ElSelect>;
    },
    mounted() {
        this.$emit('fc.el', this.$refs.el);
    }
});
