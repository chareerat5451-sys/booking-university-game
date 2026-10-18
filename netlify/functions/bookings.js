import { getStore } from "@netlify/blobs";

// ===================== CONFIG =====================
// ศูนย์ฟื้นฟูสมรรถภาพทางด้านวิทยาศาสตร์การกีฬาเคลื่อนที่
// การแข่งขันกีฬามหาวิทยาลัยแห่งประเทศไทย ครั้งที่ 52 รอบคัดเลือก เขตภาคกลาง
// 19-23 ตุลาคม 2569 (2026), เวลา 08:00-20:00

const YEAR = 2026;
const MONTH_INDEX = 9; // October (0-indexed: Jan=0)
const DAY_FROM = 18;
const DAY_TO = 23;
const OPEN_MIN = 8 * 60; // 08:00
const CLOSE_MIN = 20 * 60; // 20:00

const SERVICES = [
  { id: "nuad60", name: "นวดผ่อนคลายทางการกีฬา (60 นาที)", capacity: 3, durationMin: 60, advanceMin: 30 },
  { id: "therapy", name: "เครื่องบำบัดสุญญากาศแรงดันลบ", capacity: 1, durationMin: 30, advanceMin: 0 },
  { id: "coldspray", name: "เครื่องพ่นเย็นเฉพาะจุด", capacity: 1, durationMin: 5, advanceMin: 0 },
  { id: "capsule", name: "แคปซูลออกซิเจนแรงดันสูง", capacity: 1, durationMin: 60, advanceMin: 0 },
  { id: "kinesio", name: "ติดเทป Kinesio Tex", capacity: 4, durationMin: 15, advanceMin: 0 },
];

const SPORT_TYPES = [
  "กีฬาบาสเกตบอล ทีมชาย",
  "กีฬาวอลเลย์บอล ทีมหญิง",
  "กีฬาฟุตซอล ทีมชาย",
  "กีฬาฟุตซอล ทีมหญิง",
  "กีฬาเซปักตะกร้อ ทีมชาย",
  "กีฬาเซปักตะกร้อ ทีมหญิง",
  "กีฬาเปตอง",
];

// ทีมเวชศาสตร์: วนมอบหมายตามคิวการจอง (admin เห็นเท่านั้น ผู้จองไม่เห็น)
const PROVIDER_TEAMS = [
  "ทีมที่ 1 อ.ชารีรัตน์",
  "ทีมที่ 2 อ.พิษณุ",
  "ทีมที่ 3 อ.กฤษฏ์",
  "ทีมที่ 4 อ.ณัฏฐ์ดนัย",
];

const STATUS_OPTIONS = ["นักกีฬา", "เจ้าหน้าที่"];

// เพดานรวมทุกบริการ: ไม่ว่าจะเป็นบริการใด ในช่วงเวลาที่ทับซ้อนกัน
// ห้ามมีคนรอรับบริการเกินจำนวนทีมเวชศาสตร์ที่มีจริง (4 ทีม)
const TEAM_CAPACITY = PROVIDER_TEAMS.length;

const LOCATIONS = [
  "ศูนย์ประสานงาน มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา",
  "มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ ศูนย์พระนครศรีอยุธยา หันตรา",
  "มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา โรงยิม 1",
  "มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา โรงยิม 2",
  "ทัณฑสถานบำบัดพิเศษพระนครศรีอยุธยา",
];

// บริการที่ให้บริการได้จริงในแต่ละสถานที่ — เครื่องมือหนัก (เครื่องบำบัดสุญญากาศ/แคปซูลออกซิเจน)
// เคลื่อนย้ายไม่ได้ มีให้บริการครบทุกอย่างเฉพาะที่ "ศูนย์ประสานงาน มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา" เท่านั้น
// สถานที่แข่งขันอื่นมีแค่นวด+ติดเทป (โรงแรม G2 เลิกให้บริการแล้ว — ไม่อยู่ในระบบอีกต่อไป)
const LOCATION_SERVICES = {
  "ศูนย์ประสานงาน มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา": ["therapy", "coldspray", "capsule", "nuad60", "kinesio"],
  "มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ ศูนย์พระนครศรีอยุธยา หันตรา": ["nuad60", "kinesio"],
  "มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา โรงยิม 1": ["nuad60", "kinesio"],
  "มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา โรงยิม 2": ["nuad60", "kinesio"],
  "ทัณฑสถานบำบัดพิเศษพระนครศรีอยุธยา": ["nuad60", "kinesio"],
};

function isServiceAllowedAtLocation(serviceId, location) {
  const allowed = LOCATION_SERVICES[location];
  if (!allowed) return true; // ไม่รู้จักสถานที่ ปล่อยผ่าน (validateCommonFields กันไว้อีกชั้นแล้วว่า location ต้องอยู่ใน LOCATIONS)
  return allowed.includes(serviceId);
}

// ===================== เวลาเดินทางระหว่างสถานที่ =====================
// ประมาณจากระยะทางจริงในอยุธยา (เส้นตรง + ปรับตามถนนจริง) ไม่ใช่ตัวเลขวัดจริงหน้างาน
// "ศูนย์ประสานงาน มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา" อยู่ในมหาวิทยาลัยเดียวกับโรงยิม 1-2 จึงถือเป็นโซน "rajabhat" เดียวกัน (เดินทาง 0 นาที)
const LOCATION_ZONE = {
  "ศูนย์ประสานงาน มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา": "rajabhat",
  "มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ ศูนย์พระนครศรีอยุธยา หันตรา": "rmutsb",
  "มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา โรงยิม 1": "rajabhat",
  "มหาวิทยาลัยราชภัฏพระนครศรีอยุธยา โรงยิม 2": "rajabhat",
  "ทัณฑสถานบำบัดพิเศษพระนครศรีอยุธยา": "correctional",
};

// นาทีเดินทางโดยรถ ระหว่างแต่ละกลุ่มสถานที่ (รวมเวลาจอด/ขนอุปกรณ์คร่าวๆ ไว้แล้ว)
const ZONE_TRAVEL_MIN = {
  rajabhat: { rajabhat: 0, rmutsb: 15, correctional: 5 },
  rmutsb: { rajabhat: 15, rmutsb: 0, correctional: 20 },
  correctional: { rajabhat: 5, rmutsb: 20, correctional: 0 },
};

// เวลาเดินทางที่ต้องใช้ (นาที) ระหว่างสถานที่ A กับ B — ถ้าไม่รู้จักสถานที่ใดสถานที่หนึ่ง ถือว่า 0
// (กันระบบพังถ้ามีค่าสถานที่แปลกปลอม แต่ในทางปฏิบัติ validateCommonFields บังคับให้ location ต้องอยู่ใน LOCATIONS อยู่แล้ว)
function travelMinutesBetween(locA, locB) {
  if (!locA || !locB || locA === locB) return 0;
  const zoneA = LOCATION_ZONE[locA];
  const zoneB = LOCATION_ZONE[locB];
  if (!zoneA || !zoneB) return 0;
  return (ZONE_TRAVEL_MIN[zoneA] && ZONE_TRAVEL_MIN[zoneA][zoneB]) ?? 0;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function datesInRange() {
  const out = [];
  for (let d = DAY_FROM; d <= DAY_TO; d++) {
    const dt = new Date(YEAR, MONTH_INDEX, d);
    out.push({
      iso: `${YEAR}-${pad2(MONTH_INDEX + 1)}-${pad2(d)}`,
      day: d,
      label: dt.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return out;
}

function minToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function slotsForService(svc) {
  const out = [];
  for (let t = OPEN_MIN; t + svc.durationMin <= CLOSE_MIN; t += svc.durationMin) {
    out.push({
      id: `${svc.id}-${t}`,
      startMin: t,
      endMin: t + svc.durationMin,
      label: `${minToHHMM(t)}-${minToHHMM(t + svc.durationMin)}`,
    });
  }
  return out;
}

function findService(id) {
  return SERVICES.find((s) => s.id === id);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}

function errJson(stage, error, status = 500) {
  return json(
    {
      ok: false,
      stage,
      error: error && error.message ? error.message : String(error),
      stack: error && error.stack ? String(error.stack) : undefined,
    },
    status
  );
}

function nowMinutesUntil(dateIso, startMin) {
  // คำนวณจำนวนนาทีนับจาก "ตอนนี้" ถึงเวลาเริ่มของ slot (ใช้เวลาไทย UTC+7)
  const target = new Date(`${dateIso}T00:00:00+07:00`);
  target.setMinutes(target.getMinutes() + startMin);
  const now = new Date();
  return (target.getTime() - now.getTime()) / 60000;
}

function store() {
  // ใช้ consistency: "strong" เพื่อให้อ่านค่าล่าสุดได้ทันทีหลังบันทึก
  // (ค่าเริ่มต้นของ Netlify Blobs เป็น eventual consistency ซึ่งข้อมูลที่เพิ่งบันทึก
  // อาจยังไม่ปรากฏตอนอ่านกลับมาทันที ทำให้การนับคิวเพื่อวนทีม/ตรวจจำนวนที่นั่งคลาดเคลื่อนได้)
  return getStore({ name: "university-games-bookings", consistency: "strong" });
}

async function listAll() {
  const s = store();
  const keys = [];
  let cursor;
  do {
    const page = await s.list({ prefix: "bk:", cursor });
    for (const b of page.blobs) keys.push(b.key);
    cursor = page.cursor;
  } while (cursor);

  const items = await Promise.all(
    keys.map(async (k) => {
      try {
        return await s.get(k, { type: "json" });
      } catch {
        return null;
      }
    })
  );
  return items.filter(Boolean);
}

// ดึงเรคคอร์ดการจองทั้งหมดของวันที่ระบุ (ใช้ร่วมกันหลายจุด)
async function listDateRecords(s, date) {
  const keys = [];
  let cursor;
  do {
    const page = await s.list({ prefix: `bk:${date}:`, cursor });
    for (const b of page.blobs) keys.push(b.key);
    cursor = page.cursor;
  } while (cursor);

  const records = await Promise.all(
    keys.map(async (k) => {
      try {
        return await s.get(k, { type: "json" });
      } catch {
        return null;
      }
    })
  );
  return records.filter(Boolean);
}

// นับจำนวน "ทีม" (ไม่ใช่จำนวนเรคคอร์ด) ที่ถูกใช้งานในวันเดียวกันที่ช่วงเวลาทับซ้อนกับ [startMin, endMin)
// ใช้บังคับเพดานรวม 4 ทีม (ไม่ว่าจะผสมกันกี่บริการก็ตาม) แยกต่างหากจากเพดานของแต่ละบริการ
// หมายเหตุ: 1 รอบการจอง (roundId เดียวกัน) ใช้แค่ 1 ทีมเสมอ ต่อให้รอบนั้นมีหลายรายการที่เวลาทับซ้อนกัน
// (เช่น คู่ นวดผ่อนคลาย + ติดเทป Kinesio ที่ทีมเดียวกันทำพร้อมกันให้คนเดิม) จึงนับจำนวน "roundId ที่แตกต่างกัน"
// ที่ทับซ้อนช่วงเวลานี้ ไม่ใช่นับจำนวนเรคคอร์ดดิบ — ปัจจุบันใช้เฉพาะใน action "move" เท่านั้น
// (create/createBatch เปลี่ยนไปใช้ pickRoundTeam ซึ่งตรวจทั้งจำนวนทีมและเวลาเดินทางแม่นยำกว่า)
async function countOverlappingAnyService(s, date, startMin, endMin, opts = {}) {
  const { excludeKey, excludeRoundId } = opts;
  const records = (await listDateRecords(s, date)).filter((b) => b.key !== excludeKey);

  const overlapping = records.filter(
    (b) => b.startMin < endMin && startMin < b.endMin
  );

  const roundIds = new Set();
  for (const b of overlapping) {
    const rid = b.roundId || b.key; // ข้อมูลเก่าที่ไม่มี roundId ให้แยกนับเป็นของตัวเอง
    if (excludeRoundId && rid === excludeRoundId) continue;
    roundIds.add(rid);
  }
  return roundIds.size;
}

function makeKey(dateIso, slotId) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `bk:${dateIso}:${slotId}:${ts}-${rand}`;
}

function makeRoundId() {
  return `rnd:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const ROUND_SEQ_KEY = "meta:roundSeq";

// เลือกทีมให้ "รอบการจอง" นี้ โดยต้องเป็นทีมที่ (1) ไม่มีงานอื่นทับซ้อนเวลาเดียวกัน และ
// (2) เดินทางจากงานก่อนหน้า/ไปงานถัดไปของทีมนั้นทันเวลาจริง (ตามตารางเวลาเดินทางด้านบน)
// ลำดับการเลือก: ยังคงไล่ตาม round-robin เดิมก่อน (เพื่อความเป็นธรรมในระยะยาว) แต่ถ้าทีมที่ควรได้คิว
// ตามลำดับเดินทางไม่ทัน จะข้ามไปหาทีมถัดไปที่ว่างและเดินทางทันแทนโดยอัตโนมัติ
// ถ้าไม่มีทีมไหนว่าง/เดินทางทันเลยสักทีม ถือว่าคิวช่วงเวลานี้เต็ม (คืนค่า null)
// หมายเหตุ: Netlify Blobs ไม่มี atomic increment ในตัว การจองพร้อมกันแบบชนวินาทีเป๊ะๆ
// อาจมีโอกาสได้ลำดับเดียวกันน้อยมาก แต่เพียงพอสำหรับสเกลงานนี้
async function pickRoundTeam(s, date, items, location) {
  const dateRecords = await listDateRecords(s, date);

  function teamIsFeasible(team) {
    const teamRecords = dateRecords.filter((b) => b.providerTeam === team);
    for (const item of items) {
      for (const b of teamRecords) {
        const overlap = item.startMin < b.endMin && b.startMin < item.endMin;
        if (overlap) return false; // ทีมติดงานอื่นอยู่ในช่วงเวลานี้พอดี

        let gap, fromLoc, toLoc;
        if (item.startMin >= b.endMin) {
          gap = item.startMin - b.endMin;
          fromLoc = b.location;
          toLoc = location;
        } else {
          gap = b.startMin - item.endMin;
          fromLoc = location;
          toLoc = b.location;
        }
        if (gap < travelMinutesBetween(fromLoc, toLoc)) return false; // เดินทางไม่ทัน
      }
    }
    return true;
  }

  let current = 0;
  try {
    const existing = await s.get(ROUND_SEQ_KEY, { type: "json" });
    if (typeof existing === "number") current = existing;
  } catch {
    current = 0;
  }
  await s.set(ROUND_SEQ_KEY, JSON.stringify(current + 1));

  for (let i = 0; i < PROVIDER_TEAMS.length; i++) {
    const team = PROVIDER_TEAMS[(current + i) % PROVIDER_TEAMS.length];
    if (teamIsFeasible(team)) return team;
  }
  return null;
}

function validateCommonFields(fields) {
  if (
    !fields ||
    !fields.name ||
    !fields.status ||
    !fields.sportType ||
    !fields.phone ||
    !fields.location ||
    fields.athleteCount === undefined ||
    fields.athleteCount === null ||
    fields.athleteCount === ""
  ) {
    return "missing_fields";
  }
  if (!STATUS_OPTIONS.includes(fields.status)) return "invalid_status";
  if (!SPORT_TYPES.includes(fields.sportType)) return "invalid_sport_type";
  if (!LOCATIONS.includes(fields.location)) return "invalid_location";
  const athleteCount = Number(fields.athleteCount);
  if (!Number.isInteger(athleteCount) || athleteCount < 1) return "invalid_athlete_count";
  return null;
}

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    let body = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }
    const action = body.action || url.searchParams.get("action") || "meta";

    if (action === "meta") {
      return json({
        ok: true,
        services: SERVICES,
        dates: datesInRange(),
        sportTypes: SPORT_TYPES,
        statusOptions: STATUS_OPTIONS,
        locations: LOCATIONS,
        openMin: OPEN_MIN,
        closeMin: CLOSE_MIN,
        teamCapacity: TEAM_CAPACITY,
        locationZone: LOCATION_ZONE,
        zoneTravelMin: ZONE_TRAVEL_MIN,
        locationServices: LOCATION_SERVICES,
      });
    }

    if (action === "diag") {
      const s = store();
      await s.set("diag:ping", JSON.stringify({ t: Date.now() }));
      const read = await s.get("diag:ping", { type: "json" });
      const all = await listAll();
      return json({ ok: true, blobsWritable: !!read, totalBookings: all.length });
    }

    if (action === "listAll") {
      const all = await listAll();
      return json({ ok: true, bookings: all });
    }

    if (action === "dateCounts") {
      const all = await listAll();
      const counts = {};
      for (const b of all) {
        counts[b.date] = (counts[b.date] || 0) + 1;
      }
      return json({ ok: true, counts });
    }

    if (action === "create") {
      const { date, slotId, serviceId, fields } = body;
      const svc = findService(serviceId);
      if (!svc) return json({ ok: false, err: "invalid_service" }, 400);

      const slots = slotsForService(svc);
      const slot = slots.find((sl) => sl.id === slotId);
      if (!slot) return json({ ok: false, err: "invalid_slot" }, 400);

      const dates = datesInRange();
      if (!dates.find((d) => d.iso === date)) {
        return json({ ok: false, err: "invalid_date" }, 400);
      }

      const fieldErr = validateCommonFields(fields);
      if (fieldErr) return json({ ok: false, err: fieldErr }, 400);
      const athleteCount = Number(fields.athleteCount);

      if (!isServiceAllowedAtLocation(svc.id, fields.location)) {
        return json(
          { ok: false, err: "service_not_available_at_location", detail: { serviceName: svc.name, location: fields.location } },
          400
        );
      }

      if (svc.advanceMin > 0) {
        const minsUntil = nowMinutesUntil(date, slot.startMin);
        if (minsUntil < svc.advanceMin) {
          return json(
            { ok: false, err: "too_late", advanceMin: svc.advanceMin },
            409
          );
        }
      }

      const s = store();
      const prefix = `bk:${date}:${slotId}:`;
      const page = await s.list({ prefix });
      const existing = page.blobs.length;

      if (existing >= svc.capacity) {
        return json({ ok: false, err: "slot_full" }, 409);
      }

      // การจองเดี่ยว (1 ช่วงเวลา) ก็ถือเป็น "1 รอบ" เช่นกัน — เลือกทีมที่ว่างและเดินทางทันให้
      const providerTeam = await pickRoundTeam(s, date, [{ startMin: slot.startMin, endMin: slot.endMin }], fields.location);
      if (!providerTeam) {
        return json({ ok: false, err: "team_full", teamCapacity: TEAM_CAPACITY }, 409);
      }
      const roundId = makeRoundId();

      const key = makeKey(date, slotId);
      const record = {
        key,
        date,
        slotId,
        serviceId: svc.id,
        serviceName: svc.name,
        slotLabel: slot.label,
        startMin: slot.startMin,
        endMin: slot.endMin,
        name: fields.name,
        status: fields.status,
        sportType: fields.sportType,
        phone: fields.phone,
        location: fields.location,
        athleteCount,
        note: fields.note || "",
        providerTeam,
        roundId,
        createdAt: Date.now(),
      };

      await s.set(key, JSON.stringify(record));
      return json({ ok: true, booking: record });
    }

    if (action === "createBatch") {
      // จองได้หลายรายการในคราวเดียว (1 ครั้งที่กดยืนยัน = 1 รอบ)
      // รองรับทั้งแบบเดิม (serviceId + slotIds เดียว) และแบบตะกร้า (items: [{serviceId, slotId}])
      // ที่ผสมหลายบริการได้ในรอบเดียว แต่ต้องเป็น "วันเดียวกัน" ทั้งรอบ
      // ทุกรายการที่เลือกในรอบนี้จะได้ "ทีมเดียวกัน" ทั้งหมด
      const { date, serviceId, slotIds, fields } = body;
      let items = Array.isArray(body.items) ? body.items : null;

      if (!items) {
        // รองรับรูปแบบเดิม: serviceId เดียว + slotIds หลายช่วงเวลา
        if (!serviceId || !Array.isArray(slotIds) || slotIds.length === 0) {
          return json({ ok: false, err: "missing_slots" }, 400);
        }
        items = slotIds.map((slotId) => ({ serviceId, slotId }));
      }

      if (!Array.isArray(items) || items.length === 0) {
        return json({ ok: false, err: "missing_slots" }, 400);
      }

      const dates = datesInRange();
      if (!dates.find((d) => d.iso === date)) {
        return json({ ok: false, err: "invalid_date" }, 400);
      }

      const fieldErr = validateCommonFields(fields);
      if (fieldErr) return json({ ok: false, err: fieldErr }, 400);
      const athleteCount = Number(fields.athleteCount);

      const resolvedItems = items.map((item) => {
        const svc = findService(item && item.serviceId);
        const slot = svc ? slotsForService(svc).find((sl) => sl.id === item.slotId) : null;
        return { serviceId: item && item.serviceId, slotId: item && item.slotId, svc, slot };
      });

      // ตรวจสอบก่อนว่าทุกบริการในตะกร้าให้บริการได้จริงที่ "สถานที่ใช้บริการ" ที่เลือกไว้ทั้งรอบ
      // (เครื่องมือหนักมีแค่ที่ศูนย์ประสานงาน ม.ราชภัฏฯ, สถานที่อื่นมีแค่นวด+ติดเทป)
      const notAllowed = resolvedItems.find((r) => r.svc && !isServiceAllowedAtLocation(r.svc.id, fields.location));
      if (notAllowed) {
        return json(
          {
            ok: false,
            err: "service_not_available_at_location",
            detail: { serviceName: notAllowed.svc.name, location: fields.location },
          },
          400
        );
      }

      // เวลาทับซ้อนกันภายในรอบเดียวกันได้เสมอ ไม่ว่าจะผสมบริการใดก็ตาม (ตราบใดที่ทุกบริการให้บริการได้จริง
      // ที่สถานที่นี้ตามเช็คด้านบนแล้ว) เพราะทีมเดียวกันดูแลทั้งรอบอยู่แล้ว — ไม่จำกัดเฉพาะคู่นวด+ติดเทปอีกต่อไป

      const s = store();

      // มอบหมายทีมและรหัสรอบให้ทั้งตะกร้าครั้งเดียว ก่อนสร้างคิวทีละรายการ
      // ต้องเป็นทีมที่ว่างและเดินทางไป "สถานที่ใช้บริการ" ของทั้งรอบนี้ทันทุกช่วงเวลาที่เลือกไว้
      const roundIntervals = resolvedItems
        .filter((r) => r.slot)
        .map((r) => ({ startMin: r.slot.startMin, endMin: r.slot.endMin }));
      const providerTeam = await pickRoundTeam(s, date, roundIntervals, fields.location);
      if (!providerTeam) {
        return json({ ok: false, err: "team_full", teamCapacity: TEAM_CAPACITY }, 409);
      }
      const roundId = makeRoundId();

      const results = [];
      for (const item of items) {
        const itemServiceId = item && item.serviceId;
        const slotId = item && item.slotId;
        const svc = findService(itemServiceId);
        if (!svc) {
          results.push({ serviceId: itemServiceId, slotId, ok: false, err: "invalid_service" });
          continue;
        }

        const slots = slotsForService(svc);
        const slot = slots.find((sl) => sl.id === slotId);
        if (!slot) {
          results.push({ serviceId: svc.id, slotId, ok: false, err: "invalid_slot" });
          continue;
        }

        if (svc.advanceMin > 0) {
          const minsUntil = nowMinutesUntil(date, slot.startMin);
          if (minsUntil < svc.advanceMin) {
            results.push({ serviceId: svc.id, slotId, ok: false, err: "too_late", advanceMin: svc.advanceMin });
            continue;
          }
        }

        const prefix = `bk:${date}:${slotId}:`;
        const page = await s.list({ prefix });
        if (page.blobs.length >= svc.capacity) {
          results.push({ serviceId: svc.id, slotId, ok: false, err: "slot_full" });
          continue;
        }
        // (ทีมของทั้งรอบถูกเลือกไว้แล้วผ่าน pickRoundTeam ด้านบน — ตรวจทั้งจำนวนทีมว่างและเวลาเดินทางให้ทุกช่วงเวลาในรอบนี้พร้อมกันแล้ว)

        const key = makeKey(date, slotId);
        const record = {
          key,
          date,
          slotId,
          serviceId: svc.id,
          serviceName: svc.name,
          slotLabel: slot.label,
          startMin: slot.startMin,
          endMin: slot.endMin,
          name: fields.name,
          status: fields.status,
          sportType: fields.sportType,
          phone: fields.phone,
          location: fields.location,
          athleteCount,
          note: fields.note || "",
          providerTeam,
          roundId,
          createdAt: Date.now(),
        };
        await s.set(key, JSON.stringify(record));
        results.push({ serviceId: svc.id, slotId, ok: true, booking: record });
      }

      return json({ ok: true, providerTeam, roundId, results });
    }

    if (action === "cancel") {
      const { key } = body;
      if (!key) return json({ ok: false, err: "missing_key" }, 400);
      const s = store();
      await s.delete(key);
      return json({ ok: true });
    }

    if (action === "cancelBatch") {
      const { keys } = body;
      if (!Array.isArray(keys) || keys.length === 0) {
        return json({ ok: false, err: "missing_keys" }, 400);
      }
      const s = store();
      await Promise.all(keys.map((k) => s.delete(k)));
      return json({ ok: true });
    }

    if (action === "move") {
      const { key, newDate, newSlotId } = body;
      if (!key || !newDate || !newSlotId) {
        return json({ ok: false, err: "missing_fields" }, 400);
      }
      const s = store();
      const existingRecord = await s.get(key, { type: "json" });
      if (!existingRecord) return json({ ok: false, err: "not_found" }, 404);

      const svc = findService(existingRecord.serviceId);
      if (!svc) return json({ ok: false, err: "invalid_service" }, 400);

      const slots = slotsForService(svc);
      const slot = slots.find((sl) => sl.id === newSlotId);
      if (!slot) return json({ ok: false, err: "invalid_slot" }, 400);

      const dates = datesInRange();
      if (!dates.find((d) => d.iso === newDate)) {
        return json({ ok: false, err: "invalid_date" }, 400);
      }

      if (svc.advanceMin > 0) {
        const minsUntil = nowMinutesUntil(newDate, slot.startMin);
        if (minsUntil < svc.advanceMin) {
          return json(
            { ok: false, err: "too_late", advanceMin: svc.advanceMin },
            409
          );
        }
      }

      const newPrefix = `bk:${newDate}:${newSlotId}:`;
      const page = await s.list({ prefix: newPrefix });
      const existingCount = page.blobs.length;
      if (existingCount >= svc.capacity) {
        return json({ ok: false, err: "slot_full" }, 409);
      }

      const overlapCount = await countOverlappingAnyService(s, newDate, slot.startMin, slot.endMin, {
        excludeKey: key,
        excludeRoundId: existingRecord.roundId,
      });
      if (overlapCount >= TEAM_CAPACITY) {
        return json({ ok: false, err: "team_full", teamCapacity: TEAM_CAPACITY }, 409);
      }

      await s.delete(key);
      // ย้ายคิวไม่เปลี่ยนทีมที่มอบหมายไว้แล้ว (ทีมผูกกับลำดับการจองเดิม ไม่ใช่ช่วงเวลาใหม่)
      const newKey = makeKey(newDate, newSlotId);
      const record = {
        ...existingRecord,
        key: newKey,
        date: newDate,
        slotId: newSlotId,
        slotLabel: slot.label,
        startMin: slot.startMin,
        endMin: slot.endMin,
        movedAt: Date.now(),
      };
      await s.set(newKey, JSON.stringify(record));
      return json({ ok: true, booking: record });
    }

    return json({ ok: false, err: "unknown_action" }, 400);
  } catch (error) {
    return errJson("top", error, 500);
  }
};
