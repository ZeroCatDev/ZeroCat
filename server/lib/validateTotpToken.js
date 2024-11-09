const express = require('express');
const { isTotpTokenValid } = require('./totpUtils');

// TOTP validation middleware
async function validateTotpToken(req, res, next) {
  try {
    // Extract TOTP token from query, body, or headers
    const token = req.query.totp_token || req.body.totp_token || req.headers['x-totp-token'];
    console.log(token)
    if (!res.locals.login) {
        // 未登录，返回401 Unauthorized状态码
        return res.status(401).send({ status: "0", msg: "请先登录以继续操作" });
      }
    if (!token) {
      // If no token is provided, return a failure response
      return res.status(400).json({
        status: 'error',
        message: '令牌未提供',
      });
    }

    // Check if the TOTP token is valid
    const userId = res.locals.userid; // Assuming the user ID is available in the request (e.g., from authentication middleware)
    const isValid = await isTotpTokenValid(userId, token);

    if (isValid.valid === false) {
      // If the token is invalid, return a failure response
      return res.status(400).json({
        status: 'error',
        message: '无法处理请求：'+isValid.message,
      });
    }

    // If valid, move to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Error in TOTP validation middleware:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error during TOTP validation.',
    });
  }
}

module.exports = validateTotpToken;
