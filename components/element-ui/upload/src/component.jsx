import toArray from '@form-create/utils/lib/toarray';
import getSlot from '@form-create/utils/lib/slot';
import './style.css';
import {defineComponent} from 'vue';
import IconUpload from './IconUpload.vue';

function parseFile(file, i) {
    if (typeof file === 'object') {
        return file;
    }
    return {
        url: file,
        is_string: true,
        name: getFileName(file),
        uid: i
    };
}

function parseUpload(file) {
    return {...file, file, value: file};
}

function getFileName(file) {
    return ('' + file).split('/').pop()
}

const NAME = 'fcUpload';

export default defineComponent({
    name: NAME,
    inheritAttrs: false,
    formCreateParser: {
        toFormValue(value) {
            return toArray(value);
        },
        toValue(formValue, ctx) {
            return ctx.prop.props.limit === 1 ? (formValue[0] || '') : formValue;
        }
    },
    props: {
        previewMask: undefined,
        onPreview: Function,
        httpRequest: Function,
        modalTitle: String,
        listType: String,
        formCreateInject: Object,
        modelValue: [Array, String, Object]
    },
    emits: ['update:modelValue', 'change', 'remove', 'fc.el'],
    data() {
        return {
            previewVisible: false,
            previewImage: '',
            fileList: [],
        }
    },
    created() {
        this.fileList = toArray(this.modelValue).map(parseFile).map(parseUpload);
    },
    watch: {
        modelValue(n) {
            this.fileList = toArray(n).map(parseFile).map(parseUpload);
        }
    },
    methods: {
        handlePreview(file) {
            if (this.onPreview) {
                this.onPreview(...arguments);
            } else {
                if ('text' === this.listType) {
                    window.open(file.url);
                } else {
                    this.previewImage = file.url;
                    this.previewVisible = true;
                }
            }
        },
        update(fileList) {
            let files = fileList.map((v) => v.is_string ? v.url : (v.value || v.url)).filter((url) => url !== undefined);
            this.$emit('update:modelValue', files);
        },
        handleCancel() {
            this.previewVisible = false;
        },
        handleChange(file, fileList) {
            this.$emit('change', ...arguments);
            if (file.status === 'success') {
                this.update(fileList);
            }
        },
        handleRemove(file, fileList) {
            this.$emit('remove', ...arguments);
            this.update(fileList);
        },
        doHttpRequest(option) {
            if (this.httpRequest) {
                return this.httpRequest(option);
            } else {
                option.source = 'upload';
                this.formCreateInject.api.fetch(option);
            }
        },
    },
    render() {
        const len = toArray(this.modelValue).length;
        return (
            <div class="_fc-upload"><ElUpload key={len} {...this.$attrs} listType={this.listType || 'picture-card'}
                class={{'_fc-exceed': this.$attrs.limit ? this.$attrs.limit <= len : false}}
                onPreview={this.handlePreview} onChange={this.handleChange}
                onRemove={this.handleRemove} httpRequest={this.doHttpRequest}
                fileList={this.fileList}
                v-slots={getSlot(this.$slots, ['default'])} ref="upload">
                {((this.$slots.default?.()) ||
                    (['text', 'picture'].indexOf(this.listType) === -1 ? <ElIcon>
                        <IconUpload/>
                    </ElIcon> : <ElButton type="primary">{this.formCreateInject.t('clickToUpload') || '点击上传'}</ElButton>)
                )}
            </ElUpload>
            <ElDialog appendToBody={true} modal={this.previewMask} title={this.modalTitle}
                modelValue={this.previewVisible}
                onClose={this.handleCancel}>
                <img style="width: 100%" src={this.previewImage}/>
            </ElDialog>
            </div>);
    },
    mounted() {
        this.$emit('fc.el', this.$refs.upload);
    }
})
