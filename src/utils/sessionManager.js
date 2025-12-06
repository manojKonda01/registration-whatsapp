// Simple in-memory session manager
// For production replace with Redis or DB

const sessions = new Map();

export function setSession(phone, sessionObj) {
  sessions.set(phone, sessionObj);
}
export function getSession(phone) {
  return sessions.get(phone);
}
export function clearSession(phone) {
  sessions.delete(phone);
}
export function allSessions() {
  return Array.from(sessions.entries());
}
