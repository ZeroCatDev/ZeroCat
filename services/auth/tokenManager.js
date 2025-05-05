import jwt from "jsonwebtoken";
import zcconfig from "../config/zcconfig.js";
import { createTypedJWT } from "./tokenUtils.js";

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
  const { sha256, type, action, userid: tokenUserid } = decoded.data;
  if (type !== "file" || action !== "read" || (tokenUserid !== userid && tokenUserid !== 0)) {
    throw new Error("Invalid token");
  }
  return sha256;
}
