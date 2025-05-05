import jwt from "jsonwebtoken";
import zcconfig from "../config/zcconfig.js";
import { createTypedJWT } from "./tokenUtils.js";
import logger from "../logger.js";
export async function generateFileAccessToken(sha256, userid) {
  return createTypedJWT("file", {
    action: "read",
    issuer: await zcconfig.get("site.domain"),
    sha256: sha256,
    userid: userid,
  }, 5 * 60); // 5分钟
}

export async function verifyFileAccessToken(token, userid) {
  const decoded = jwt.verify(token, await zcconfig.get("security.jwttoken"));
  if (!decoded) {
    throw new Error("Invalid token");
  }
  const { sha256, action, userid: tokenUserid } = decoded.data;
  const type = decoded.type;
  if (type !== "file" || action !== "read" || (tokenUserid !== userid && tokenUserid !== 0)) {


    throw new Error("Invalid token");
  }
  return sha256;
}
