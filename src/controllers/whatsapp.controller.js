import dotenv from "dotenv";
import axios from "axios";
import { getSession, setSession, clearSession } from "../utils/sessionManager.js";
import { sendWhatsAppMessage } from "../utils/whatsappSender.js";
import { saveRegistrationToMongo, findByPhone } from "../services/mongo.service.js";
import { appendSheetRow } from "../services/sheets.service.js";
import { templates } from "../utils/messageTemplates.js";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const processed = new Set();

export const verifyWebhook = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
};


function extractIncomingText(entry) {
    // Walk the webhook structure to find text (supports text messages & interactive replies)
    try {
        const msg = entry.messaging[0].messages[0];
        if (!msg) return null;
        if (msg.type === "text") return msg.text.body;
        if (msg.type === "interactive") {
            if (msg.interactive.type === "button_reply") return msg.interactive.button_reply.title;
            if (msg.interactive.type === "list_reply") return msg.interactive.list_reply.title;
        }
    } catch (err) {
        // Fallback for Graph API variations
        try {
            const messages = entry.changes[0].value.messages;
            const m = messages && messages[0];
            if (!m) return null;
            if (m.type === "text") return m.text.body;
            if (m.type === "interactive") return m.interactive.button_reply?.title || m.interactive.list_reply?.title || null;
        } catch (e) {
            return null;
        }
    }
    return null;
}

function extractFromWebhook(req) {
    const body = req.body;
    // The incoming structure may be at body.entry[] with changes[].value
    // We'll try to return number and text
    try {
        const entry = body.entry?.[0] || {};
        const changes = entry.changes?.[0] || {};
        const value = changes.value || entry.messaging?.[0] || body;
        const messages = value.messages || entry.messaging?.[0]?.messages;
        const message = messages?.[0] || value.messages?.[0];
        const from = message?.from || message?.author;
        const text = extractIncomingText({ messaging: [{ messages: [message] }], changes: [{ value }] }) || extractIncomingText(entry);
        return { from, text, raw: body };
    } catch (err) {
        return { from: null, text: null, raw: body };
    }
}

// Define steps with validation
const STEPS = [
    { key: "email", question: templates.askEmail, validate: val => /^\S+@\S+\.\S+$/.test(val), error: "✉️ Invalid email format" },
    { key: "name", question: templates.askName, validate: val => /^[a-zA-Z\s]+$/.test(val), error: "🧑 Name cannot contain numbers or special characters" },
    { key: "zip", question: templates.askZip, validate: val => /^\d+$/.test(val), error: "📮 Zip must be numeric" },
    { key: "country", question: templates.askCountry, validate: val => /^[a-zA-Z\s]+$/.test(val), error: "🌍 Country cannot contain numbers or special characters" },
    { key: "state", question: templates.askState, validate: val => /^[a-zA-Z\s]+$/.test(val), error: "🗺️ State cannot contain numbers or special characters" },
    { key: "city", question: templates.askCity, validate: val => /^[a-zA-Z\s]+$/.test(val), error: "🏙️ City cannot contain numbers or special characters" },
    { key: "address", question: templates.askAddress, validate: val => val.trim() !== "", error: "🏠 Address cannot be empty" },
    { key: "phone_inp", question: templates.askPhone, validate: val => val.toLowerCase() === "skip" || /^\+?\d{10,15}$/.test(val), error: "📞 Phone must be numeric or type SKIP to use your WhatsApp number" },
    { key: "accommodation", question: templates.askAccommodation, validate: val => ["1", "2", "yes", "no"].includes(val.toLowerCase()), error: "🛏️ Reply 1 for Yes, 2 for No" },
    { key: "arrivalDate", question: templates.askArrivalDate, validate: val => val.trim() !== "", error: "📅 Arrival date cannot be empty" },
    { key: "arrivalTime", question: templates.askArrivalTime, validate: val => val.trim() !== "", error: "🕒 Arrival time cannot be empty" },
    { key: "departureDate", question: templates.askDepartureDate, validate: val => val.trim() !== "", error: "📅 Departure date cannot be empty" },
    { key: "transport", question: templates.askTransport, validate: val => val.trim() !== "", error: "🚗 Transport cannot be empty" },
    { key: "attendeeNumbers", question: templates.askAttendeeNumbers, validate: val => /^[0-9,\s]+$/.test(val), error: "👥 Numbers format invalid" },
    { key: "attendeeNames", question: templates.askAttendeeNames, validate: val => val.trim() !== "", error: "📝 Names cannot be empty" },
    { key: "volunteering", question: templates.askVolunteering, validate: val => val.trim() !== "", error: "🤝 Invalid input" },
    { key: "special", question: templates.askSpecial, validate: val => val.trim() !== "", error: "♿ Invalid input" },
    { key: "baptism", question: templates.askBaptism, validate: val => val.trim() !== "", error: "💧 Invalid input" }
];

async function processStep(session, phone, text) {
    const stepObj = STEPS.find(s => s.key === session.step);
    if (!stepObj) return;

    if (!stepObj.validate(text)) {
        await sendWhatsAppMessage(phone, stepObj.error);
        return; // ask same question again
    }

    session.data[session.step] = text.trim();

    // Move to next step
    const currentIndex = STEPS.findIndex(s => s.key === session.step);
    if (currentIndex + 1 < STEPS.length) {
        session.step = STEPS[currentIndex + 1].key;
        await sendWhatsAppMessage(phone, STEPS[currentIndex + 1].question);
    } else {
        // Registration complete, show summary
        session.data.registrationId = `HC-2025-${uuidv4().split("-")[0].toUpperCase()}`;
        session.data.completedAt = new Date().toISOString();

        await sendWhatsAppMessage(phone, formatRegistrationSummaryWithEdit(session.data));
        session.step = "editMenu";
        setSession(phone, session);
    }
}

function formatRegistrationSummaryWithEdit(data) {
    const fields = [
        { label: "Email", key: "email" },
        { label: "Name", key: "name" },
        { label: "Phone", key: "phone_inp" },
        { label: "Address", key: "address" },
        { label: "City", key: "city" },
        { label: "State", key: "state" },
        { label: "Country", key: "country" },
        { label: "ZIP", key: "zip" },
        { label: "Accommodation", key: "accommodation" },
        { label: "Arrival Date", key: "arrivalDate" },
        { label: "Arrival Time", key: "arrivalTime" },
        { label: "Departure Date", key: "departureDate" },
        { label: "Transport", key: "transport" },
        { label: "Volunteering", key: "volunteering" },
        { label: "Special Accommodations", key: "special" },
        { label: "Baptism", key: "baptism" },
    ];

    let msg = "✅ *Registration Summary*\n\n";
    fields.forEach((f, idx) => {
        msg += `${idx + 1}. ${f.label}: ${data[f.key] || "—"}\n`;
    });
    msg += `\nTo edit, reply with the number (e.g., 1 for Name). Reply NO to confirm.`;

    return msg;
}

async function handleEditMenu(session, phone, text) {
    const lowerText = text.trim().toLowerCase();
    if (lowerText === "no") {
        session.data.phone = (session?.data['phone_inp']?.toLowerCase() === "skip") ? session?.data['phone_inp'] : phone;
        const saved = await saveRegistrationToMongo(session.data);
        await appendSheetRow(session.data);
        clearSession(phone);
        await sendWhatsAppMessage(phone, "✅ Registration saved successfully!");
        return;
    }

    const fieldIndex = parseInt(text) - 1;
    if (isNaN(fieldIndex) || fieldIndex < 0 || fieldIndex >= STEPS.length) {
        await sendWhatsAppMessage(phone, "Invalid choice. Reply with the field number or NO to finish.");
        return;
    }

    session.step = STEPS[fieldIndex].key;
    await sendWhatsAppMessage(phone, `Enter new value for ${STEPS[fieldIndex].key}:`);
}


export const receiveMessage = async (req, res) => {
    try {
        // Accept quick 200 for webhook; process asynchronously but still in this function
        const { from, text } = extractFromWebhook(req);
        if (!from) {
            return res.sendStatus(200);
        }
        const phone = from; // WhatsApp phone (including country)
        const lowerText = (text || "").trim();

        // Check registered user
        const existing = await findByPhone(phone);
        if (existing && lowerText.toLowerCase() === "hi" || lowerText.toLowerCase() === "register") {
            // If greeting and user exists, return their details
            const msg = `👋 Welcome back! We found a registration under this number:\n\n${formatRegistrationSummary(existing)}\n\nReply *UPDATE* to edit or *NEW* to register another person.`;
            await sendWhatsAppMessage(phone, msg);
            return res.sendStatus(200);
        }

        // Check if user is already registered and asked for details explicitly
        if (existing && lowerText.toLowerCase() === "details") {
            const msg = `👋 Here are your registration details:\n\n${formatRegistrationSummary(existing)}\n\nReply *UPDATE* to edit.`;
            await sendWhatsAppMessage(phone, msg);
            return res.sendStatus(200);
        }

        // Session management
        let session = getSession(phone);
        if (!session) {
            // If user already exists and they send any message, show details by default
            if (existing) {
                const msg = `👋 We found an existing registration for this number.\n\n${formatRegistrationSummary(existing)}\n\nReply *UPDATE* to edit or *NEW* to create a new registration.`;
                await sendWhatsAppMessage(phone, msg);
                return res.sendStatus(200);
            }

            // Start new session
            session = { step: STEPS[0], data: { phone }, startedAt: Date.now() };
            setSession(phone, session);
            await sendWhatsAppMessage(phone, templates.welcome);
            await sendWhatsAppMessage(phone, templates.askEmail);
            return res.sendStatus(200);
        }

        // If session exists, handle specific commands
        if (lowerText.toLowerCase() === "cancel") {
            clearSession(phone);
            await sendWhatsAppMessage(phone, "✅ Registration cancelled. To start again, send *Register* or *Hi*.");
            return res.sendStatus(200);
        }
        if (lowerText.toLowerCase() === "new") {
            clearSession(phone);
            const newSession = { step: STEPS[0], data: { phone }, startedAt: Date.now() };
            setSession(phone, newSession);
            await sendWhatsAppMessage(phone, templates.askEmail);
            return res.sendStatus(200);
        }
        if (lowerText.toLowerCase() === "update" && existing) {
            // Start edit flow: populate session data with existing doc and start from a safe step
            const editSession = { step: "name", data: { ...existing, phone }, editing: true };
            setSession(phone, editSession);
            await sendWhatsAppMessage(phone, "✅ Edit mode: I will ask questions and update your registration. You can reply *CANCEL* at any time.");
            await sendWhatsAppMessage(phone, templates.askName);
            return res.sendStatus(200);
        }

        // Save response based on session.step
        const step = session.step;

        // Basic step handlers and validation
        switch (step) {
            case "email":
                session.data.email = lowerText;
                session.step = "name";
                await sendWhatsAppMessage(phone, templates.askName);
                break;

            case "name":
                session.data.name = text;
                session.step = "address";
                await sendWhatsAppMessage(phone, templates.askAddress);
                break;

            case "address":
                session.data.address = text;
                session.step = "city";
                await sendWhatsAppMessage(phone, templates.askCity);
                break;

            case "city":
                session.data.city = text;
                session.step = "state";
                await sendWhatsAppMessage(phone, templates.askState);
                break;

            case "state":
                session.data.state = text;
                session.step = "country";
                await sendWhatsAppMessage(phone, templates.askCountry);
                break;

            case "country":
                session.data.country = text;
                session.step = "zip";
                await sendWhatsAppMessage(phone, templates.askZip);
                break;

            case "zip":
                session.data.zip = text;
                session.step = "phone";
                await sendWhatsAppMessage(phone, templates.askPhone);
                break;

            case "phone":
                session.data.phone = text || phone; // prefer explicit typed phone or fallback to WhatsApp
                session.step = "accommodation";
                await sendWhatsAppMessage(phone, templates.askAccommodation);
                break;

            case "accommodation":
                // expect 1 or 2
                session.data.accommodation = text.trim();
                if (["1", "2", "yes", "no"].includes(text.toLowerCase())) {
                    session.step = "arrivalDate";
                    await sendWhatsAppMessage(phone, templates.askArrivalDate);
                } else {
                    await sendWhatsAppMessage(phone, "Please reply *1* for Yes or *2* for No.");
                }
                break;

            case "arrivalDate":
                session.data.arrivalDate = text;
                session.step = "arrivalTime";
                await sendWhatsAppMessage(phone, templates.askArrivalTime);
                break;

            case "arrivalTime":
                session.data.arrivalTime = text;
                session.step = "departureDate";
                await sendWhatsAppMessage(phone, templates.askDepartureDate);
                break;

            case "departureDate":
                session.data.departureDate = text;
                session.step = "transport";
                await sendWhatsAppMessage(phone, templates.askTransport);
                break;

            case "transport":
                session.data.transport = text;
                session.step = "attendeeNumbers";
                await sendWhatsAppMessage(phone, templates.askAttendeeNumbers);
                break;

            case "attendeeNumbers":
                // store raw or try to parse, we expect "0 1 0 1 2" or comma separated
                session.data.attendeeNumbers = text;
                session.step = "attendeeNames";
                await sendWhatsAppMessage(phone, templates.askAttendeeNames);
                break;

            case "attendeeNames":
                session.data.attendeeNames = text;
                session.step = "volunteering";
                await sendWhatsAppMessage(phone, templates.askVolunteering);
                break;

            case "volunteering":
                session.data.volunteering = text;
                session.step = "special";
                await sendWhatsAppMessage(phone, templates.askSpecial);
                break;

            case "special":
                session.data.special = text;
                session.step = "baptism";
                await sendWhatsAppMessage(phone, templates.askBaptism);
                break;

            case "baptism":
                session.data.baptism = text;
                // Completed registration
                session.data.registrationId = `HC-2025-${uuidv4().split("-")[0].toUpperCase()}`;
                session.data.completedAt = new Date().toISOString();

                // Persist to MongoDB & Google Sheets
                const saved = await saveRegistrationToMongo(session.data);
                await appendSheetRow(session.data);

                // Confirmation message with summary
                await sendWhatsAppMessage(phone, `✅ *Registration complete!* Here is your summary:\n\n${formatRegistrationSummary(session.data)}\n\nIf you'd like to update, reply *UPDATE*`);
                clearSession(phone);
                break;

            default:
                // Unknown step — reset
                clearSession(phone);
                await sendWhatsAppMessage(phone, "Sorry, something went wrong. Please send *Register* or *Hi* to start again.");
                break;
        }
        setSession(phone, session);


        return res.sendStatus(200);
    } catch (err) {
        console.error("receiveMessage error", err);
        return res.sendStatus(500);
    }
};
export const receiveMessage_new = async (req, res) => {
    try {
        const { from, text } = extractFromWebhook(req);
        console.log(from, text)
        if (!from) return res.sendStatus(200);

        const phone = from;
        const lowerText = (text || "").trim().toLowerCase();

        const existing = await findByPhone(phone);

        let session = getSession(phone);

        const messageId =
            req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;

        if (!messageId) return res.sendStatus(200);

        // Ignore duplicates
        if (processed.has(messageId)) {
            console.log("⚠️ Duplicate webhook ignored:", messageId);
            return res.sendStatus(200);
        }
        processed.add(messageId);


        if (!session) {
            if (existing) {
                await sendWhatsAppMessage(phone, `👋 Existing registration:\n\n${formatRegistrationSummaryWithEdit(existing)}\nReply *UPDATE* to edit or *NEW* to register again.`);
                setSession(phone, { ...existing, step: "editMenu" });
                return res.sendStatus(200);
            }

            session = { step: STEPS[0].key, data: { phone }, startedAt: Date.now() };
            setSession(phone, session);
            await sendWhatsAppMessage(phone, templates.welcome);
            await sendWhatsAppMessage(phone, STEPS[0].question);
            return res.sendStatus(200);
        }

        if (lowerText === "cancel") {
            clearSession(phone);
            await sendWhatsAppMessage(phone, "✅ Registration cancelled. Send *Hi* to start again.");
            return res.sendStatus(200);
        }

        if (lowerText === "new") {
            clearSession(phone);
            const newSession = { step: STEPS[0].key, data: { phone }, startedAt: Date.now() };
            setSession(phone, newSession);
            await sendWhatsAppMessage(phone, STEPS[0].question);
            return res.sendStatus(200);
        }

        if (lowerText === "update" && existing) {
            const editSession = { step: "editMenu", data: { ...existing }, editing: true };
            setSession(phone, editSession);
            await sendWhatsAppMessage(phone, formatRegistrationSummaryWithEdit(existing));
            return res.sendStatus(200);
        }

        // Process step or edit
        if (session.step === "editMenu") {
            await handleEditMenu(session, phone, text);
        } else {
            await processStep(session, phone, text);
        }

        setSession(phone, session);
        return res.sendStatus(200);
    } catch (err) {
        console.error("receiveMessage error", err);
        return res.sendStatus(500);
    }
};