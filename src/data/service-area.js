// Confirmed service cities, shared by the visible lists and structured data.
const city = (en, ru, he, ar, fr = en) => ({ en, ru, he, ar, fr });
export const serviceRegions = [
  [
    city("Sderot", "Сдерот", "שדרות", "سديروت", "Sdérot"),
    city("Ashkelon", "Ашкелон", "אשקלון", "عسقلان"),
    city("Ashdod", "Ашдод", "אשדוד", "أشدود"),
    city("Yavne", "Явне", "יבנה", "يفنه", "Yavné"),
    city("Rehovot", "Реховот", "רחובות", "رحوفوت"),
    city("Ness Ziona", "Нес-Циона", "נס ציונה", "نيس تسيونا"),
    city("Rishon LeZion", "Ришон-ле-Цион", "ראשון לציון", "ريشون لتسيون"),
  ],
  [
    city("Tel Aviv-Yafo", "Тель-Авив-Яффо", "תל אביב-יפו", "تل أبيب-يافا", "Tel-Aviv-Jaffa"),
    city("Bat Yam", "Бат-Ям", "בת ים", "بات يام"),
    city("Holon", "Холон", "חולון", "حولون"),
    city("Ramat Gan", "Рамат-Ган", "רמת גן", "رمات غان"),
    city("Givatayim", "Гиватаим", "גבעתיים", "جفعتايم"),
    city("Bnei Brak", "Бней-Брак", "בני ברק", "بني براك"),
    city("Petah Tikva", "Петах-Тиква", "פתח תקווה", "بيتاح تكفا"),
    city("Rosh HaAyin", "Рош-ха-Аин", "ראש העין", "روش هعاين"),
  ],
  [
    city("Herzliya", "Герцлия", "הרצליה", "هرتسليا"),
    city("Ramat HaSharon", "Рамат-ха-Шарон", "רמת השרון", "رمات هشارون"),
    city("Hod HaSharon", "Ход-ха-Шарон", "הוד השרון", "هود هشارون"),
    city("Kfar Saba", "Кфар-Сава", "כפר סבא", "كفار سابا"),
    city("Ra'anana", "Раанана", "רעננה", "رعنانا"),
    city("Netanya", "Нетания", "נתניה", "نتانيا"),
    city("Hadera", "Хадера", "חדרה", "الخضيرة", "Hadéra"),
    city("Haifa", "Хайфа", "חיפה", "حيفا", "Haïfa"),
  ],
  [
    city("Lod", "Лод", "לוד", "اللد"),
    city("Ramla", "Рамла", "רמלה", "الرملة", "Ramlé"),
    city("Modi'in-Maccabim-Re'ut", "Модиин-Маккабим-Реут", "מודיעין-מכבים-רעות", "موديعين-مكابيم-ريعوت", "Modiin-Maccabim-Réout"),
    city("Beit Shemesh", "Бейт-Шемеш", "בית שמש", "بيت شيمش"),
    city("Jerusalem", "Иерусалим", "ירושלים", "القدس", "Jérusalem"),
  ],
];
export const serviceCities = serviceRegions.flat();
