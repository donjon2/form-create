import deepExtend from './deepextend';
import {err} from './console';
import is from './type';

const PREFIX = '[[FORM-CREATE-PREFIX-';
const SUFFIX = '-FORM-CREATE-SUFFIX]]';

export function toJson(obj, space) {
    return JSON.stringify(deepExtend(Array.isArray(obj) ? [] : {}, obj, true), function (key, val) {
        if (val && val._isVue === true)
            return undefined;

        if (typeof val !== 'function') {
            return val;
        }
        if (val.__json) {
            return val.__json;
        }
        if (val.__origin)
            val = val.__origin;

        if (val.__emit)
            return undefined;
        return PREFIX + val + SUFFIX;
    }, space);
}

function makeFn(fn) {
    // 处理所有控制字符和特殊字符
    fn = fn.replace(/[\n\r\t\b\f\v\0\u2028\u2029]/g, function(match) {
        return {
            '\n': '\\n',    // 换行符
            '\r': '\\r',    // 回车符
            '\t': '\\t',    // 制表符
            '\b': '\\b',    // 退格符
            '\f': '\\f',    // 换页符
            '\v': '\\v',    // 垂直制表符
            '\0': '\\0',    // 空字符
            '\u2028': '\\u2028',  // 行分隔符
            '\u2029': '\\u2029'   // 段落分隔符
        }[match];
    });
    
    // 处理双引号
    fn = fn.replace(/"/g, '\\"');
    
    try {
        fn = JSON.parse(`"${fn}"`);
        return (new Function('return ' + fn))();
    } catch (e) {
        console.warn('Parse function error:', e);
        return fn;
    }
}

export function parseFn(fn, mode) {
    if (fn && is.String(fn) && fn.length > 4) {
        let v = fn.trim();
        let flag = false;
        try {
            if (v.indexOf(SUFFIX) > 0 && v.indexOf(PREFIX) === 0) {
                v = v.replace(SUFFIX, '').replace(PREFIX, '');
                flag = true;
            } else if (v.indexOf('$FN:') === 0) {
                v = v.substring(4);
                flag = true;
            } else if (v.indexOf('$EXEC:') === 0) {
                v = v.substring(6);
                flag = true;
            } else if (v.indexOf('$GLOBAL:') === 0) {
                const name = v.substring(8);
                v = function (...args) {
                    const callback = args[0].api.getGlobalEvent(name);
                    if (callback) {
                        return callback.call(this, ...args);
                    }
                    return undefined;
                }
                v.__json = fn;
                v.__inject = true;
                return v;
            } else if (v.indexOf('$FNX:') === 0) {
                v = makeFn('function($inject){\n' + v.substring(5) + '\n}');
                v.__json = fn;
                v.__inject = true;
                return v;
            } else if (!mode && v.indexOf('function ') === 0 && v !== 'function ') {
                flag = true;
            } else if (!mode && v.indexOf('function(') === 0 && v !== 'function(') {
                flag = true;
            }
            if (!flag) return fn;
            let val;
            try{
                val = makeFn(v);
            }catch (e){
                val = makeFn('function ' + v);
            }
            val.__json = fn;
            return val;
        } catch (e) {
            err(`解析失败:${v}\n\nerr: ${e}`);
            return undefined;
        }
    }
    return fn;
}

export function parseJson(json, mode) {
    return JSON.parse(json, function (k, v) {
        if (is.Undef(v) || !v.indexOf) return v;
        return parseFn(v, mode);
    });
}
