// Populates the SQLite database with the club's current menu and price data.
// Safe to re-run: it wipes and rewrites the three seeded tables each time.
require("dotenv").config();
const db = require("./db");

const MENU = [
  ["Бургери", "Бургер з курятиною", 230, "Соковитий бургер з курячою котлетою. Подається з картоплею фрі", "burger-chicken"],
  ["Бургери", "Бургер зі свининою", 230, "Соковитий бургер зі свиняною котлетою. Подається з картоплею фрі", "burger-pork"],
  ["Бургери", "Бургер з телятиною", 230, "Соковитий бургер з телячою котлетою. Подається з картоплею фрі", "burger-beef"],
  ["Шаурма", "Шаурма з куркою", 180, "Шаурма з куркою за авторським рецептом, 500 г", "shaurma"],
  ["Шаурма", "Шаурма з куркою та сиром", 200, "Шаурма з куркою та сиром за авторським рецептом, 550 г", "shaurma-cheese"],
  ["Шаурма", "Cyber Roll", 110, "Загорнуті в тонкий лаваш шматочки курятини, свіжі помідори та хрумка пекінка", null],
  ["Закуски", "Картопля Фрі", 70, "Картопля фрі 150 г", "fries"],
  ["Закуски", "Цибулеві кільця", 99, "Цибулеві кільця в хрусткій паніровці, подаються з білим соусом", "onion-rings"],
  ["Закуски", "Чікен нагетс", 120, "Закуска з курячого філе в хрусткій паніровці", "nuggets"],
  ["Закуски", "Картопляні діпи з беконом", 110, "Хрусткі картопляні діпи, всипані беконом та покриті сиром", "potato-dips"],
  ["Закуски", "Соус в асортименті", 30, "Барбекю, сирний, часниковий та інші", "sauce"],
  ["Закуски", "Кільця кальмару", 170, "Кільця кальмару в паніровці, подаються з білим соусом", "squid"],
  ["Закуски", "Джерки в асортименті 50 г", 140, "", null],
  ["Закуски", "Курячі крильця кріспі", 229, "Курячі крильця, вкриті хрусткою паніровкою", "wings"],
  ["Закуски", "Сирні кульки халапеньо", 199, "Популярна гостра закуска з ніжним сиром усередині", null],
  ["Гарячі напої", "Капучино", 45, "", "cappuccino"],
  ["Гарячі напої", "Чай в асортименті", 60, "Чай заварний в асортименті: чорний, чорний з апельсином та інші", "tea"],
  ["Гарячі напої", "Латте", 60, "", "latte"],
  ["Гарячі напої", "Амерікано", 30, "", "americano"],
  ["Гарячі напої", "Какао стандартне", 40, "Гарячий напій на основі молока, 220 мл", "cocoa"],
  ["Гарячі напої", "Какао велике", 60, "Гарячий напій на основі молока, 350 мл", "cocoa-big"],
  ["Холодні напої", "Молочний коктейль", 100, "Смак на вибір: шоколад, банан, полуниця, лісовий горіх", "milkshake"],
  ["Холодні напої", "Лимонад", 60, "Авторські лимонади: полуниця-лічі, манго та інші", "lemonade"],
  ["Холодні напої", "Айс лате", 75, "", "ice-latte"],
  ["Коктейлі", "Lemonade Ace", 190, "", "lemonade-ace"],
  ["Коктейлі", "Support", 180, "", "support"],
  ["Коктейлі", "Earthshaker", 200, "", "earthshaker"],
  ["Пиво", "Пиво Львівське 1715", 60, "Пиво Львівське світле 500 мл, 4.5%", "lvivske"],
  ["Пиво", "Пиво Blanc 330 мл", 60, "Пиво Кроненбург Бланш 330 мл, 4,8%", "blanc"],
  ["Пиво", "Пиво Paulaner Lager (фільтроване)", 150, "Paulaner Lager (фільтроване), 500 мл, 4.9%", "paulaner-lager"],
  ["Пиво", "Пиво Paulaner Wheat (нефільтроване)", 150, "Paulaner Wheat (нефільтроване), 500 мл, 5.5%", "paulaner-wheat"],
  ["Пиво", "Пиво Staropramen", 70, "Пиво Staropramen світле, 500 мл 4.2%", "staropramen"],
  ["Пиво", "Сидр Somersby", 80, "Сидр Somersby яблуко, 500 мл, 4.7% алк", "somersby"],
  ["Пиво", "Сидр Somersby Чорниця 0.5 л", 80, "", "somersby-blue"],
  ["Пиво", "Stella Artois 0,5 л", 90, "", "stella"],
  ["Пиво", "Carlsberg безалкогольне 500 мл", 80, "", "carlsberg"],
  ["Пиво", "Kronenbourg 1664 Blanc", 90, "", "kronenbourg"],
  ["Віскі", "Віскі Jack Daniel's Old #7", 110, "Віскі Jack Daniel's Old #7 40%, 50 мл", "jd-old7"],
  ["Віскі", "Віскі Jack Daniel's Honey", 120, "Віскі Jack Daniel`s Honey 35%, 50 мл", "jd-honey"],
  ["Віскі", "Віскі Jack Daniel`s Tennessee Apple", 120, "Віскі Jack Daniel`s Tennessee Apple 35%, 50 мл", "jd-apple"],
  ["Віскі", "Віскі Jack Daniel`s Tennessee Fire", 120, "Віскі Jack Daniel`s Tennessee Fire 35%, 50 мл", "jd-fire"],
  ["Віскі", "Віскі Jameson", 110, "Віскі Jameson 40%, 50 мл", "jameson"],
  ["Віскі", "Віскі Ballantine`s Finest", 110, "Віскі Ballantine`s Finest 40%, 50 мл", "ballantines"],
  ["Віскі", "Віскі Bell`s Original", 70, "Віскі Bell`s Original 40%, 50 мл", "bells"],
  ["Ром", "Ром Bacardi Oakheart", 80, "Ром Bacardi Oakheart 35%, 50 мл", "bacardi"],
  ["Ром", "Ром Captain Morgan Spiced Black", 90, "Ром Captain Morgan Spiced Black 40%, 50 мл", "cm-black"],
  ["Ром", "Ром Captain Morgan White", 80, "Ром Captain Morgan White 37,5%, 50 мл", "cm-white"],
  ["Інше", "Настоянка Jagermeister", 90, "Настоянка Jagermeister 35%, 50 мл", "jager"],
  ["Інше", "Джин Gordon`s", 90, "Джин Gordon`s 37,5%, 50 мл", "gordons"],
  ["Інше", "Лікер Jagermeister Orange", 150, "", "jager-orange"]
];

const CLUB_PRICES = {
  saltovka: {
    zones: [
      { zone: "Gaming zone", cpu: "Intel Core i3-12100F", gpu: "RX 5700XT (аналог 3060)", ram: "16GB DDR4", monitor: "Asus TUF 24\" 144Hz", periph: "Bloody B820R (механіка), Hator Pulsar (HTM-323), HyperX Cloud Alpha", chair: "Cougar Armor Pro", wd: [70, 190, 280, 380, 300], we: [80, 220, 320, 430, 350] },
      { zone: "VIP zone", badge: "Топ зона · Bootcamp", isTop: true, cpu: "Intel Core i7-12700", gpu: "Nvidia RTX 3060Ti", ram: "32GB DDR4", monitor: "LG IPS 27\" 240Hz 1ms", periph: "HyperX (механіка), HyperX Pulsefire Surge, HyperX Alpha", chair: "Cougar Armor Pro", wd: [105, 280, 400, 570, 450], we: [125, 340, 500, 670, 550] },
      { zone: "PRO zone", cpu: "Intel Core i5-12400F", gpu: "RX 5700XT (аналог 3060)", ram: "16GB DDR4", monitor: "Lenovo Legion 24\" 240Hz", periph: "Bloody B820R (механіка), Hator Pulsar (HTM-323), HyperX Cloud Alpha", chair: "Cougar Armor Pro", wd: [80, 220, 320, 430, 350], we: [90, 240, 360, 490, 400] }
    ],
    ps: [
      { title: "PlayStation 5 + TV 65\" 120Hz", rows: [["1 година", "200 грн"], ["3 години", "500 грн"], ["5 годин", "700 грн"], ["День* (9 годин)", "1000 грн"], ["Ніч (22:00–07:00)", "800 грн"]] },
      { title: "PS5 VIP + ігровий TV 65\" 144Hz", badge: "VIP", isVip: true, rows: [["1 година", "250 грн"], ["3 години", "600 грн"], ["5 годин", "900 грн"], ["День* (9 годин)", "1200 грн"], ["Ніч (22:00–07:00)", "1000 грн"]] }
    ]
  },
  pobeda: {
    zones: [
      { zone: "Gaming zone", cpu: "Intel Core i3-12100F", gpu: "RX 5700XT (аналог 3060)", ram: "16GB DDR4", monitor: "Gigabyte 27\" 165Hz Curved", periph: "Bloody B820R (механіка), Hator Pulsar (HTM-323), HyperX Cloud Alpha", chair: "Cougar Armor Pro", wd: [70, 190, 280, 380, 300], we: [80, 220, 320, 430, 350] },
      { zone: "VIP zone", badge: "Топ зона · Bootcamp", isTop: true, cpu: "AMD Ryzen 7 5700x", gpu: "Nvidia RTX 3060Ti", ram: "32GB DDR4", monitor: "BenQ XL2566K 25\" 360Hz", periph: "HyperX (механіка), HyperX Pulsefire Surge, HyperX Alpha", chair: "Cougar Armor Pro", wd: [105, 280, 400, 570, 450], we: [125, 340, 500, 670, 550] },
      { zone: "PRO zone", cpu: "Intel Core i5-12400F", gpu: "RX 5700XT (аналог 3060)", ram: "16GB DDR4", monitor: "Lenovo Legion 24\" 240Hz", periph: "Bloody B820R (механіка), Hator Pulsar (HTM-323), HyperX Cloud Alpha", chair: "Cougar Armor Pro", wd: [80, 220, 320, 430, 350], we: [90, 240, 360, 490, 400] }
    ],
    ps: [
      { title: "PlayStation 5 + TV 65\" 120Hz", rows: [["1 година", "200 грн"], ["3 години", "500 грн"], ["5 годин", "700 грн"], ["День* (9 годин)", "1000 грн"], ["Ніч (22:00–07:00)", "800 грн"]] },
      { title: "PlayStation 4 Pro + телевізор 55\"", rows: [["1 година", "150 грн"], ["3 години", "400 грн"], ["5 годин", "550 грн"], ["День* (9 годин)", "750 грн"], ["Ніч (22:00–07:00)", "600 грн"]] }
    ]
  },
  holodka: {
    zones: [
      { zone: "Gaming zone", cpu: "Intel Core i3-12100F", gpu: "RX 5700XT (аналог 3060)", ram: "16GB DDR4", monitor: "Asus TUF 24\" 144Hz", periph: "Bloody B820R (механіка), Hator Pulsar (HTM-323), HyperX Cloud Alpha", chair: "Cougar Armor Pro", wd: [70, 190, 280, 380, 300], we: [80, 220, 320, 430, 350] },
      { zone: "VIP zone", badge: "Топ зона · VIP", isTop: true, cpu: "Intel Core i7-12700", gpu: "Nvidia RTX 3060Ti", ram: "32GB DDR4", monitor: "BenQ 25\" 240Hz 1ms", periph: "HyperX / Xtrfy (механіка), HyperX Pulsefire Surge, гарнітура HyperX / Logitech G Pro X", chair: "Cougar Armor Pro", wd: [105, 280, 400, 570, 450], we: [125, 340, 500, 670, 550] },
      { zone: "PRO zone", cpu: "Intel Core i5-12400F", gpu: "RX 5700XT (аналог 3060)", ram: "16GB DDR4", monitor: "Lenovo Legion 24\" 240Hz", periph: "Bloody B820R (механіка), Hator Pulsar (HTM-323), HyperX Cloud Alpha", chair: "Cougar Armor Pro", wd: [80, 220, 320, 430, 350], we: [90, 240, 360, 490, 400] }
    ],
    ps: [
      { title: "PlayStation 5, телевізор 55\"", rows: [["1 година", "200 грн"], ["3 години", "500 грн"], ["5 годин", "700 грн"], ["День* (9 годин)", "1000 грн"], ["Ніч (22:00–07:00)", "800 грн"]] },
      { title: "PS5 VIP + TV QLED 75\" 120Hz, звук 5.1", badge: "VIP", isVip: true, rows: [["1 година", "250 грн"], ["3 години", "600 грн"], ["5 годин", "900 грн"], ["День* (9 годин)", "1200 грн"], ["Ніч (22:00–07:00)", "1000 грн"]] }
    ]
  },
  palac: {
    zones: [
      { zone: "PRO zone", cpu: "AMD Ryzen 5 7500F", gpu: "RTX 5060", ram: "16GB DDR5", monitor: "Lenovo Legion 24\" 240Hz", periph: "Bloody S87 (механіка), Bloody R72 Pro Duo (бездротова), HyperX Cloud Alpha", chair: "Cougar Armor EVO S", wd: [80, 220, 320, 430, 350], we: [90, 240, 260, 490, 400] },
      { zone: "SuperVIP zone", badge: "Нова генерація", isTop: true, cpu: "AMD Ryzen 7 7800X3D", gpu: "AMD RX 9070XT", ram: "32GB DDR5", monitor: "MSI 24\" 600Hz", periph: "HyperX Alloy Origins TKL, Logitech G PRO X Superlight 2, HyperX Cloud Alpha (бездротова)", chair: "Cougar Armor EVO", wd: [170, 460, 680, 950, 750], we: [200, 540, 800, 1100, 850] },
      { zone: "VIP zone", cpu: "AMD Ryzen 7 7700", gpu: "Radeon RX 9060XT", ram: "32GB DDR5", monitor: "Asus 24\" 300Hz", periph: "Bloody S87, HyperX Cloud Alpha", chair: "Cougar Armor EVO M", wd: [105, 280, 400, 570, 450], we: [125, 340, 500, 670, 550] }
    ],
    ps: [
      { title: "PlayStation 5, телевізор miniLED 65\"", rows: [["1 година", "200 грн"], ["3 години", "500 грн"], ["5 годин", "700 грн"], ["День* (9 годин)", "1000 грн"], ["Ніч (22:00–07:00)", "800 грн"]] },
      { title: "PS5 VIP + TV miniLED 65\" 144Hz, звук 2.1", badge: "VIP", isVip: true, rows: [["1 година", "250 грн"], ["3 години", "600 грн"], ["5 годин", "900 грн"], ["День* (9 годин)", "1200 грн"], ["Ніч (22:00–07:00)", "1000 грн"]] }
    ]
  },
  centr: {
    zones: [
      { zone: "PRO zone", cpu: "Intel Core i5-12400F", gpu: "RTX 3060 12GB", ram: "16GB DDR4", monitor: "Asus / Lenovo 24\" 240-280Hz", periph: "Bloody S87, Bloody W72 Ultra, HyperX Cloud Alpha", chair: "Hator", wd: [70, 190, 280, 380, 300] },
      { zone: "SuperVIP zone", badge: "Топ зона · SuperVIP", isTop: true, cpu: "AMD Ryzen 7 7800X3D", gpu: "AMD RX 9070XT 16GB", ram: "32GB DDR5", monitor: "Dell Alienware 25\" 500Hz", periph: "HyperX (клавіатура), Logitech G Pro Superlight 2 WL, HyperX Cloud III WL", chair: "Cougar EVO M", wd: [150, 400, 600, 800, 650] },
      { zone: "VIP zone", cpu: "AMD Ryzen 7 7700", gpu: "AMD RX 9060XT 16GB", ram: "32GB DDR5", monitor: "Asus 24\" 300Hz", periph: "Bloody S87, Bloody R72 Pro Duo, HyperX Alpha", chair: "Cougar Armor Pro", wd: [90, 240, 360, 470, 400] }
    ],
    ps: [
      { title: "PlayStation 5 + TV 55\"", rows: [["1 година", "150 грн"], ["День* (9 годин)", "700 грн"], ["Ніч (22:00–07:00)", "600 грн"]] }
    ]
  }
};

const insertMenu = db.prepare(`
  INSERT INTO menu_items (category, name, price_uah, note, photo, sort_order)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertZone = db.prepare(`
  INSERT INTO price_zones
    (club_slug, zone_name, badge, is_top, has_toggle, cpu, gpu, ram, monitor, periph, chair,
     wd_1h, wd_3h, wd_5h, wd_day, wd_night, we_1h, we_3h, we_5h, we_day, we_night, sort_order)
  VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?)
`);
const insertPs = db.prepare(`
  INSERT INTO ps_zones (club_slug, title, badge, is_vip, rows_json, sort_order)
  VALUES (?,?,?,?,?,?)
`);

function seed() {
  db.exec("BEGIN;");
  try {
    db.exec("DELETE FROM menu_items; DELETE FROM price_zones; DELETE FROM ps_zones;");

    MENU.forEach(([category, name, price, note, photo], i) => {
      insertMenu.run(category, name, price, note, photo, i);
    });

    for (const [slug, data] of Object.entries(CLUB_PRICES)) {
      data.zones.forEach((z, i) => {
        const hasToggle = !!z.we;
        const we = z.we || z.wd;
        insertZone.run(
          slug, z.zone, z.badge || null, z.isTop ? 1 : 0, hasToggle ? 1 : 0,
          z.cpu, z.gpu, z.ram, z.monitor, z.periph, z.chair,
          z.wd[0], z.wd[1], z.wd[2], z.wd[3], z.wd[4],
          we[0], we[1], we[2], we[3], we[4],
          i
        );
      });
      data.ps.forEach((p, i) => {
        insertPs.run(slug, p.title, p.badge || null, p.isVip ? 1 : 0, JSON.stringify(p.rows), i);
      });
    }
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

seed();
console.log(`Seeded ${MENU.length} menu items and price data for ${Object.keys(CLUB_PRICES).length} clubs.`);
