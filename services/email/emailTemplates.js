import logger from "../logger.js";
import zcconfig from "../../services/config/zcconfig.js";
const siteName = await zcconfig.get("site.name");
const siteDomain = await zcconfig.get("site.domain");
const siteEmail = await zcconfig.get("site.email");

const registrationTemplate = async (email, password) => `
  <div class="page flex-col">
    <div class="box_3 flex-col"
      style="display: flex;position: relative;width: 100%;height: 206px;background: #1289d82e;top: 0;left: 0;justify-content: center;">
      <img class="section_1 flex-col" src="https://b2.190823.xyz/2023/05/d405a5b948f858b3479fa0d60478c98f.svg"
        style="position: absolute;width: 152px;height: 152px;display: flex;top: 130px;background-size: cover;">
    </div>
    <div class="box_4 flex-col" style="margin-top: 92px;display: flex;flex-direction: column;align-items: center;">
      <div class="text-group_5 flex-col justify-between"
        style="display: flex;flex-direction: column;align-items: center;margin: 0 20px;"><span class="text_1"
          style="font-size: 26px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #000000;line-height: 37px;text-align: center;">嘿！你在${siteName}申请了账户</span><span
          class="text_2"
          style="font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #00000030;line-height: 22px;margin-top: 21px;text-align: center;">你在${siteName}申请了账户，这是你的账户信息</span>
      </div>
      <div class="box_2 flex-row"
        style="margin: 0 20px;min-height: 128px;min-width: 600px;background: #F7F7F7;border-radius: 12px;margin-top: 34px;display: flex;flex-direction: column;align-items: flex-start;padding: 32px 16px;width: calc(100% - 40px);">
        <div class="text-wrapper_4 flex-col justify-between"
          style="display: flex;flex-direction: column;margin-left: 30px;margin-bottom: 16px;"><span class="text_3"
            style="height: 22px;font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #0585ee;line-height: 22px;">账户信息</span><span
            class="text_4"
            style="margin-top: 6px;margin-right: 22px;font-size: 16px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #000000;line-height: 22px;">登录邮箱：${email}<br />密码：${password}</span>
        </div>
        <hr
          style="display: flex;position: relative;border: 1px dashed #1289d82e;box-sizing: content-box;height: 0px;overflow: visible;width: 100%;">
        <a class="text-wrapper_2 flex-col"
          style="min-width: 106px;height: 38px;background: #1289d82e;border-radius: 32px;display: flex;align-items: center;justify-content: center;text-decoration: none;margin: auto;margin-top: 32px;"
          href="https://${siteDomain}"><span class="text_5" style="color: #068bf8;">立即登录</span></a>
      </div>
      <table style="width:100%;font-weight:300;margin-bottom:10px;border-collapse:collapse">
        <tbody>
          <tr style="font-weight:300">
            <td style="width:3.2%;max-width:30px;"></td>
            <td style="max-width:540px;">
              <p style="text-align:center; margin:20px auto 14px auto;font-size:12px;color:#999;">
                此为系统邮件,如需联系请联系${siteEmail} <br /><a
                  style="text-decoration:none;word-break:break-all;word-wrap:normal; color: #333;"
                  target="_blank"> 您收到这份邮件是因为您注册了${siteName}账户 </a></p>
              <p id="cTMail-rights"
                style="max-width: 100%; margin:auto;font-size:12px;color:#999;text-align:center;line-height:22px;">
                <img border="0" src="https://cdn.wuyuan.dev/img/qrcode_for_gh_a55736ccbcb4_258_6dxqg3_.jpg"
                  style="width:100px; height:100px; margin:0 auto;"><br> 关注公众号，快速了解社区活动 <br> </p>
            </td>
            <td style="width:3.2%;max-width:30px;"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

const passwordResetTemplate = async (email, token) => `
  <div class="page flex-col">
    <div class="box_3 flex-col"
      style="display: flex;position: relative;width: 100%;height: 206px;background: #1289d82e;top: 0;left: 0;justify-content: center;">
      <img class="section_1 flex-col" src="https://b2.190823.xyz/2023/05/d405a5b948f858b3479fa0d60478c98f.svg"
        style="position: absolute;width: 152px;height: 152px;display: flex;top: 130px;background-size: cover;">
    </div>
    <div class="box_4 flex-col" style="margin-top: 92px;display: flex;flex-direction: column;align-items: center;">
      <div class="text-group_5 flex-col justify-between"
        style="display: flex;flex-direction: column;align-items: center;margin: 0 20px;"><span class="text_1"
          style="font-size: 26px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #000000;line-height: 37px;text-align: center;">嘿！你在${siteName}申请重置密码</span><span
          class="text_2"
          style="font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #00000030;line-height: 22px;margin-top: 21px;text-align: center;">你在${siteName}申请了重置密码，这是你的密码重置信息</span>
      </div>
      <div class="box_2 flex-row"
        style="margin: 0 20px;min-height: 128px;min-width: 600px;background: #F7F7F7;border-radius: 12px;margin-top: 34px;display: flex;flex-direction: column;align-items: flex-start;padding: 32px 16px;width: calc(100% - 40px);">
        <div class="text-wrapper_4 flex-col justify-between"
          style="display: flex;flex-direction: column;margin-left: 30px;margin-bottom: 16px;"><span class="text_3"
            style="height: 22px;font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #0585ee;line-height: 22px;">账户信息</span><span
            class="text_4"
            style="margin-top: 6px;margin-right: 22px;font-size: 16px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #000000;line-height: 22px;">登录邮箱：${email}</span>
        </div>
        <hr
          style="display: flex;position: relative;border: 1px dashed #1289d82e;box-sizing: content-box;height: 0px;overflow: visible;width: 100%;">
        <a class="text-wrapper_2 flex-col"
          style="min-width: 106px;height: 38px;background: #1289d82e;border-radius: 32px;display: flex;align-items: center;justify-content: center;text-decoration: none;margin: auto;margin-top: 32px;"
          href="https://${siteDomain}/app/account/retrievecallback?token=${token}"><span class="text_5"
            style="color: #068bf8;">重设密码</span></a>
        <p style="text-align:center; margin:20px auto 5px auto;font-size:12px;color:#999;">也可以复制以下链接</p>
        <p style="text-align:center; margin:0px auto 0px auto;font-size:12px;color:#999;word-break:break-all">
          https://${siteDomain}/app/account/retrievecallback?token=${token}</p>
      </div>
      <table style="width:100%;font-weight:300;margin-bottom:10px;border-collapse:collapse">
        <tbody>
          <tr style="font-weight:300">
            <td style="width:3.2%;max-width:30px;"></td>
            <td style="max-width:540px;">
              <p style="text-align:center; margin:20px auto 14px auto;font-size:12px;color:#999;">
                此为系统邮件,如需联系请联系${siteEmail} <br /><a
                  style="text-decoration:none;word-break:break-all;word-wrap:normal; color: #333;"
                  target="_blank"> 您收到这份邮件是因为您在${siteName}上申请重置密码</a></p>
              <p id="cTMail-rights"
                style="max-width: 100%; margin:auto;font-size:12px;color:#999;text-align:center;line-height:22px;">
                <img border="0" src="https://cdn.wuyuan.dev/img/qrcode_for_gh_a55736ccbcb4_258_6dxqg3_.jpg"
                  style="width:100px; height:100px; margin:0 auto;"><br> 关注公众号，快速了解社区活动 <br>
              </p>
            </td>
            <td style="width:3.2%;max-width:30px;"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

export {
  registrationTemplate,
  passwordResetTemplate,
};
