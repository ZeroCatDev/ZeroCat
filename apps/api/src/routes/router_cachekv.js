import {Router} from 'express';
import {needLogin} from '../middleware/auth.js';
import * as cachekv from '../services/cachekv.js';

const router = Router();

router.use(needLogin);

// Get value by key
router.get('/:key', async (req, res) => {
    try {
        const {key} = req.params;
        const userId = res.locals.userid;

        const value = await cachekv.get(userId, key);

        if (value === undefined) {
            return res.status(404).json({error: '键不存在'});
        }

        res.json(value);
    } catch (error) {
        console.error('获取失败:', error);
        res.status(500).json({error: '获取失败'});
    }
});

// Set value for key
router.post('/:key', async (req, res) => {
    try {
        const {key} = req.params;
        const userId = res.locals.userid;

        const item = await cachekv.set(userId, key, req.body, req.ip);

        res.json({data: item});
    } catch (error) {
        console.error('设置失败:', error);
        res.status(500).json({error: '设置失败'});
    }
});

// Delete key
router.delete('/:key', async (req, res) => {
    try {
        const {key} = req.params;
        const userId = res.locals.userid;

        const deleted = await cachekv.remove(userId, key);

        if (!deleted) {
            return res.status(404).json({error: '键不存在'});
        }

        res.json({message: 'Key deleted successfully'});
    } catch (error) {
        console.error('删除失败:', error);
        res.status(500).json({error: '删除失败'});
    }
});

// List all keys
router.get('/', async (req, res) => {
    try {
        const userId = res.locals.userid;
        const {page = 1, limit = 20, showValue = false} = req.query;

        const result = await cachekv.list(userId, {
            page: Number(page),
            limit: Number(limit),
            showValue: showValue === 'true'
        });

        res.json({
            data: result.items,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('获取失败:', error);
        res.status(500).json({error: '获取失败'});
    }
});

export default router;