import is from '@form-create/utils/lib/type';

const name = 'textarea';
export default {
    name,
    modelField: 'value',
    mergeProp(ctx) {
        let {props} = ctx.prop;
        props.type = 'textarea';
        if (props && props.autosize && props.autosize.minRows) {
            props.rows = props.autosize.minRows || 2;
        }
    },
    toFormValue(value) {
        return is.Undef(value) ? '' : value;
    }
}
