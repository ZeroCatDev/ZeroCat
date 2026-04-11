import {error as loggerError} from "../logger.js";
import {get} from "../zcconfig.js";
import axios from "axios";
import {URL} from "url";

const captchaMiddleware = async (req, res, next) => {
    const recaptcha = req.body.recaptcha || req.query.recaptcha;

    if (!recaptcha) {
        return res.status(400).send({message: "请完成验证码"});
    }

    try {
        const {url, secret} = await get("captcha");

        const response = await axios.post(
            new URL("/siteverify", url),
            null,
            {
                params: {
                    secret,
                    response: recaptcha,
                },
            }
        );

        if (response.data.success) {
            next();
        } else {
            res.status(400).send({message: "验证码无效", response: response.data});
        }
    } catch (error) {
        loggerError("Error verifying recaptcha:", error);
        res.status(500).send({message: "验证码验证失败", error: error.message});
    }
};

export default captchaMiddleware;

