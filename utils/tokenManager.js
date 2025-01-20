import jwt from "jsonwebtoken";
import configManager from "./configManager.js";

export async function generateFileAccessToken(sha256, userid) {
  return jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + 5 * 60,
      data: {
        type: "file",
        action: "read",
        issuer: await configManager.getConfig("site.domain"),
        sha256: sha256,
        userid: userid,
      },
    },
    await configManager.getConfig("security.jwttoken")
  );
}

export async function verifyFileAccessToken(token, userid) {
  const decoded = jwt.verify(token, await configManager.getConfig("security.jwttoken"));
  if (!decoded) {
    throw new Error("Invalid token");
  }
  const { sha256, type, action, userid: tokenUserid } = decoded.data;
  if (type !== "file" || action !== "read" || (tokenUserid !== userid && tokenUserid !== 0)) {
    throw new Error("Invalid token");
  }
  return sha256;
}
