import {computed, defineComponent, ref, toRef, watch} from 'vue';
import is, {hasProperty} from '@form-create/utils/lib/type';
import dayjs from 'dayjs';

const NAME = 'fcCalendar';

export default defineComponent({
    name: NAME,
    inheritAttrs: false,
    props: {
        placeholder: String,
        formCreateInject: Object,
        disabled: Boolean,
        clearable: Boolean,
        type: String,
        modelValue: [String, Array],
        minDate: [String, Date],
        maxDate: [String, Date],
    },
    emits: ['update:modelValue', 'change', 'fc.el'],
    setup(props, _) {
        const show = ref(false);
        const modelValue = toRef(props, 'modelValue');
        const formCreateInject = toRef(props, 'formCreateInject');
        const inputValue = ref(modelValue.value);

        watch(() => modelValue.value, (n) => {
            inputValue.value = n;
        })

        const formatter = (date) => {
            return dayjs(date).format('YYYY-MM-DD');
        }
        const toDate = (str) => {
            return dayjs(str).toDate();
        }

        const defaultDate = computed(() => {
            const value = modelValue.value;
            if (Array.isArray(value)) {
                return value.map(toDate);
            } else if (value) {
                return toDate(value);
            } else {
                return null;
            }
        })

        const dateRange = computed(() => {
            return {
                minDate: props.minDate ? dayjs(props.minDate).toDate() : undefined,
                maxDate: props.maxDate ? dayjs(props.maxDate).toDate() : undefined,
            }
        })

        const formatValue = (value) => {
            if (Array.isArray(value)) {
                inputValue.value = value.map(formatter);
            } else if (value) {
                inputValue.value = formatter(value);
            } else {
                inputValue.value = value;
            }
        }
        const onInput = () => {
            _.emit('update:modelValue', inputValue.value);
            _.emit('change', inputValue.value);
        }
        const strValue = {
            range() {
                return inputValue.value.length ? inputValue.value.join(' - ') : '';
            },
            multiple() {
                return inputValue.value.length ? (formCreateInject.value.t('selectedData', {length: inputValue.value.length}) ||`选择了 ${inputValue.value.length} 个日期`)  : '';
            }
        }

        return {
            show,
            inputValue,
            defaultDate,
            dateRange,
            open() {
                if (props.disabled) {
                    return;
                }
                show.value = true;
            },
            confirm(value) {
                formatValue(value);
                show.value = false;
                onInput();
            },
            getStrValue() {
                if (inputValue.value) {
                    return hasProperty(strValue, props.type) ? strValue[props.type]() : (inputValue.value || '');
                }
                return '';
            },
            clear(e) {
                e.stopPropagation();
                const value = Array.isArray(inputValue.value) ? [] : '';
                formatValue(value);
                onInput();
            }
        }
    },
    render() {
        const clearIcon = () => {
            return this.$props.clearable && !is.empty(this.inputValue) ?
                <i class="van-badge__wrapper van-icon van-icon-clear van-field__clear"
                    onClick={this.clear}></i> : undefined;
        }
        return <div class="_fc-calendar">
            <van-field ref="el" placeholder={this.placeholder} readonly disabled={this.$props.disabled}
                onClick={this.open}
                model-value={this.getStrValue()} isLink border={false} v-slots={{
                    'right-icon': clearIcon
                }}/>
            <van-calendar {...{...this.$attrs, ...this.dateRange}} show={this.show} onUpdate:show={v => (this.show = v)}
                type={this.type}
                onConfirm={this.confirm} defaultDate={this.defaultDate}/>
        </div>
    },
    mounted() {
        this.$emit('fc.el', this.$refs.el);
    }
});
