import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "app_title": "GreenGuard",
      "nav_dashboard": "Dashboard",
      "nav_complaints": "Complaints",
      "nav_collections": "Collections",
      "nav_store": "Rewards Store",
      "nav_map": "Live Map",
      "nav_upcycle": "Upcycle Hub",
      "nav_sms": "SMS Panel",
      "nav_logout": "Log Out",
      "toggle_lang": "தமிழ்",
      "points": "pts",
      "report_complaint": "Report Issue",
      "request_pickup": "Request Pickup",
      "status": "Status",
      "priority": "Priority",
      "NEW": "New",
      "IN_PROGRESS": "In Progress",
      "RESOLVED": "Resolved",
      "CLOSED": "Closed",
      "DUPLICATE": "Duplicate",
      "LOW": "Low",
      "MEDIUM": "Medium",
      "HIGH": "High",
      "CRITICAL": "Critical",
      "submit": "Submit",
      "cancel": "Cancel",
      "description": "Description",
      "location": "Location",
      "city": "City",
      "recent_activity": "Recent Activity",
      "your_impact": "Your Impact"
    }
  },
  ta: {
    translation: {
      "app_title": "க்ரீன்கார்ட்",
      "nav_dashboard": "முகப்பு",
      "nav_complaints": "புகார்கள்",
      "nav_collections": "சேகரிப்புகள்",
      "nav_store": "பரிசு கடை",
      "nav_map": "நேரடி வரைபடம்",
      "nav_upcycle": "மறுசுழற்சி மையம்",
      "nav_sms": "குறுஞ்செய்தி குழு",
      "nav_logout": "வெளியேறு",
      "toggle_lang": "English",
      "points": "புள்ளிகள்",
      "report_complaint": "புகார் அளி",
      "request_pickup": "எடுக்கக் கோரு",
      "status": "நிலை",
      "priority": "முன்னுரிமை",
      "NEW": "புதிய",
      "IN_PROGRESS": "செயல்பாட்டில்",
      "RESOLVED": "தீர்க்கப்பட்டது",
      "CLOSED": "மூடப்பட்டது",
      "DUPLICATE": "நகல்",
      "LOW": "குறைந்த",
      "MEDIUM": "நடுத்தர",
      "HIGH": "அதிக",
      "CRITICAL": "அவசர",
      "submit": "சமர்ப்பி",
      "cancel": "ரத்துசெய்",
      "description": "விளக்கம்",
      "location": "இடம்",
      "city": "நகரம்",
      "recent_activity": "சமீபத்திய செயல்பாடுகள்",
      "your_impact": "உங்கள் தாக்கம்"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
