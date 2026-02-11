const BUFFER_MARKER = "__zc_mail_buffer_base64__";

const isPlainObject = (value) => {
    if (!value || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

const encodeValue = (value) => {
    if (Buffer.isBuffer(value)) {
        return { [BUFFER_MARKER]: value.toString("base64") };
    }

    if (value instanceof Uint8Array) {
        return { [BUFFER_MARKER]: Buffer.from(value).toString("base64") };
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((item) => encodeValue(item));
    }

    if (isPlainObject(value)) {
        const result = {};
        for (const [key, item] of Object.entries(value)) {
            if (typeof item === "undefined" || typeof item === "function" || typeof item === "symbol") {
                continue;
            }
            result[key] = encodeValue(item);
        }
        return result;
    }

    return value;
};

const decodeValue = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => decodeValue(item));
    }

    if (isPlainObject(value)) {
        if (typeof value[BUFFER_MARKER] === "string") {
            return Buffer.from(value[BUFFER_MARKER], "base64");
        }

        const result = {};
        for (const [key, item] of Object.entries(value)) {
            result[key] = decodeValue(item);
        }
        return result;
    }

    return value;
};

export const encodeMailOptionsForJob = (mailOptions = {}) => {
    if (!isPlainObject(mailOptions)) {
        throw new Error("Mail options must be a plain object");
    }
    return encodeValue(mailOptions);
};

export const decodeMailOptionsFromJob = (encodedMailOptions = {}) => {
    if (!isPlainObject(encodedMailOptions)) {
        throw new Error("Encoded mail options must be a plain object");
    }
    return decodeValue(encodedMailOptions);
};
