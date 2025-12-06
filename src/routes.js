import express from "express";
import { verifyWebhook, receiveMessage, receiveMessage_new } from "./controllers/whatsapp.controller.js";

const router = express.Router();

router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveMessage_new);

// health check
router.get("/health", (req, res) => res.json({ ok: true }));

export default router;
