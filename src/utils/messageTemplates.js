export const templates = {
    welcome: "🙏 *Welcome to the 30th Holy Convocation Registration!* We'll ask a few questions. Reply *CANCEL* anytime to stop.",
    askEmail: "✉️ Please enter your *Email address*:",
    askName: "🧑 Please enter your *Full name*:",
    askAddress: "🏠 Please enter your *Address*:",
    askCity: "🏙️ Please enter your *City*:",
    askState: "🗺️ Please enter your *State*:",
    askCountry: "🌍 Please enter your *Country*:",
    askZip: "📮 Please enter your *Zip Code*:",
    askPhone: "📞 Please enter a *Phone number* (or type SKIP to use WhatsApp number):",
    askAccommodation: (phone) => sendInteractiveButtons(phone, "🛏️ Will you need accommodation?", [
        { id: "accom_yes", title: "Yes" },
        { id: "accom_no", title: "No" }
    ]), askArrivalDate: "📅 Please choose *Date of Arrival*:\n*1* - July 1\n*2* - July 2 (First day)\n*3* - July 3\n*4* - July 4\n(Type the number or write the date)",
    askArrivalTime: "🕒 Please enter your *approx. time of arrival* (e.g., 3:00 PM):",
    askDepartureDate: "📅 Please choose *Date of Departure*:\n1 - July 3\n2 - July 4\n3 - July 5\n4 - July 6",
    askTransport: "🚗 *Mode of Transportation*\n1 - Driving\n2 - Bus\n3 - Flight (O'Hare)\n4 - Flight (Midway)\n(Type the number or write the mode)",
    askAttendeeNumbers: "👥 *Number of people attending* per group. Reply in this format:\nInfant(0-4), 5-12, 13-20, 21-29, 30+\nExample: `0,1,0,1,2`",
    askAttendeeNames: "📝 Please enter FULL NAMES of all attendees separated by commas.",
    askVolunteering: "🤝 Are you willing to volunteer? Reply numbers separated by commas:\n1 - Dining Support\n2 - Sunday School Support\n3 - Photography\n4 - Videography\n5 - Tech Support\n6 - No",
    askSpecial: "♿ Any special accommodations required? (type details or 'No')",
    askBaptism: "💧 Is anyone coming who wishes to take baptism? (type names or 'No')"
};
