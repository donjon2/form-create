import {defineComponent, ref, toRef, watch} from 'vue';
import toArray from '@form-create/utils/lib/toarray';

const NAME = 'fcUploader';

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

export default defineComponent({
    name: NAME,
    inheritAttrs: false,
    props: {
        formCreateInject: Object,
        modelValue: [Array, String, Object],
        afterRead: Function,
        action: String,
        headers: Object,
        method: String,
        data: Object,
        uploadName: String,
        onSuccess: Function,
        onError: Function,
        maxCount: Number,
    },
    emits: ['update:modelValue', 'delete'],
    setup(props, _) {

        const afterRead = toRef(props, 'afterRead');
        const modelValue = toRef(props, 'modelValue', []);

        const fileList = ref(toArray(modelValue.value).map(parseFile).map(parseUpload));

        watch(() => modelValue.value, (n) => {
            fileList.value = toArray(n).map(parseFile).map(parseUpload);
        })

        const uploadValue = () => {
            let files = fileList.value.map((v) => v.is_string ? v.url : (v.value || v.url)).filter((url) => url !== undefined);
            _.emit('update:modelValue', props.maxCount === 1 ? (files[0] || '') : files);
        };

        return {
            fileList,
            modelValue,
            onDelete(file) {
                uploadValue();
                _.emit('delete', file);
            },
            uploadFile(file) {
                file.status = 'uploading';
                if (afterRead.value) {
                    return afterRead.value(file);
                } else {
                    const data = props.data || {};
                    data[props.uploadName || 'file'] = file.file;
                    props.formCreateInject.api.fetch({
                        action: props.action,
                        dataType: 'formData',
                        source: 'upload',
                        headers: props.headers || {},
                        method: props.method || 'post',
                        data
                    }).then(res => {
                        file.status = 'success';
                        props.onSuccess && props.onSuccess(res, file);
                        uploadValue();
                    }).catch(e => {
                        file.status = 'failed';
                        file.message = this.formCreateInject.t('uploadFail') || '上传失败';
                        props.onError && props.onError(e, file);
                    });
                }
            }
        }
    },
    render() {
        return <van-uploader {...this.$attrs} model-value={this.fileList}
            onUpdate:model-value={(v) => this.fileList = v}
            afterRead={this.uploadFile} onDelete={this.onDelete}/>
    }

});
