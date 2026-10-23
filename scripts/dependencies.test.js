import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import sharp from 'sharp';
import { sanitizeComment } from '../apps/api/src/services/commentService/sanitizer.js';
import { renderMarkdown } from '../apps/api/src/services/commentService/markdown.js';

test('updated mail transport generates UTF-8 MIME without contacting SMTP', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const { message, envelope } = await transport.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: '零猫测试',
        text: '依赖升级测试',
        html: '<p>依赖升级测试</p>',
    });
    assert.deepEqual(envelope.to, ['recipient@example.com']);
    assert.ok(Buffer.isBuffer(message));
    assert.match(message.toString(), /Content-Type: multipart\/alternative/);
    assert.match(message.toString(), /charset=utf-8/i);
});

test('updated sharp encodes and decodes supported image formats', async () => {
    const input = await sharp({
        create: { width: 16, height: 12, channels: 4, background: '#336699' },
    }).png().toBuffer();
    for (const format of ['webp', 'jpeg', 'png', 'avif']) {
        const output = await sharp(input).resize({ width: 8 }).toFormat(format).toBuffer();
        const metadata = await sharp(output).metadata();
        assert.equal(metadata.width, 8);
        assert.equal(metadata.height, 6);
        assert.ok(output.length > 0);
    }
});

test('comment sanitizer preserves text while stripping executable HTML', () => {
    const clean = sanitizeComment('<p>hello<img src="x" onerror="alert(1)"></p><script>alert(1)</script>');
    assert.match(clean, /hello/);
    assert.doesNotMatch(clean, /<script|onerror/i);
    assert.equal(sanitizeComment(''), '');
});

test('markdown renderer retains formatting and safe external links', () => {
    const html = renderMarkdown('**hello** [link](https://example.com) H~2~O x^2^');
    assert.match(html, /<strong>hello<\/strong>/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="nofollow noreferrer noopener"/);
    assert.match(html, /<sub>2<\/sub>/);
    assert.match(html, /<sup>2<\/sup>/);
    assert.doesNotMatch(renderMarkdown('<img src="x" onerror="alert(1)"><script>alert(1)</script>'), /<script|onerror/i);
});
