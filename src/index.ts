import { getAllDetailedEvents } from "./scrape.js";
import fs from "fs";
import path from "path";
import { createEvents, type DateArray, type EventAttributes } from "ics";

/**
 * Build "UFC.ics" and "UFC-PPV.ics" calendar feeds.
 * Runs automatically in GitHub Actions or locally with `npm start`.
 */
async function createICS(): Promise<void> {
  try {
    console.log("🟢 Fetching UFC events...");
    const events = await getAllDetailedEvents();
    if (!events?.length) throw new Error("No events retrieved.");

    console.log(`✅ Retrieved ${events.length} events.`);

    // --- All events ---
    const formattedEvents = events.map((event) =>
      formatEventForCalendar(event, "UFC")
    );
    console.log("📝 Generating UFC.ics...");
    const { error: allErr, value: allVal } = createEvents(formattedEvents);
    if (allErr) throw allErr;

    const outDir = process.cwd();
    const ufcPath = path.join(outDir, "UFC.ics");
    fs.writeFileSync(ufcPath, allVal, "utf8");
    console.log(`✅ Wrote ${ufcPath} (${Buffer.byteLength(allVal)} bytes)`);

    // --- PPV-only subset ---
    const ppvEvents = events.filter((e) => /UFC\s+\d+/.test(e.name));
    const formattedPPV = ppvEvents.map((e) =>
      formatEventForCalendar(e, "UFC-PPV")
    );
    console.log(`📝 Generating UFC-PPV.ics (${formattedPPV.length} events)...`);
    const { error: ppvErr, value: ppvVal } = createEvents(formattedPPV);
    if (ppvErr) throw ppvErr;

    const ppvPath = path.join(outDir, "UFC-PPV.ics");
    fs.writeFileSync(ppvPath, ppvVal, "utf8");
    console.log(`✅ Wrote ${ppvPath} (${Buffer.byteLength(ppvVal)} bytes)`);

    console.log("🎯 ICS generation complete!");
  } catch (error) {
    console.error("❌ Error generating ICS:", error);
    process.exitCode = 1; // ensure GitHub Actions marks as failure on real issues
  }
}

/**
 * Convert a UFCEvent into an ICS EventAttributes object.
 */
function formatEventForCalendar(
  event: UFCEvent,
  calName = "UFC"
): EventAttributes {
  const date = new Date(parseInt(event.date) * 1000);
  const start: DateArray = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
  const duration = { hours: 3 };
  const title = event.name;
  let description = "";

  if (event.fightCard?.length) description += `${event.fightCard.join("\n")}\n`;
  if (event.mainCard?.length)
    description += `Main Card\n--------------------\n${event.mainCard.join(
      "\n"
    )}\n`;
  if (event.prelims?.length) {
    description += "\nPrelims";
    if (event.prelimsTime) {
      const prelimsTime = new Date(parseInt(event.prelimsTime) * 1000);
      const hoursAgo = (+date - +prelimsTime) / 3600000;
      if (hoursAgo > 0) description += ` (${hoursAgo} hrs before Main)`;
    }
    description += `\n--------------------\n${event.prelims.join("\n")}\n`;
  }
  if (event.earlyPrelims?.length) {
    description += "\nEarly Prelims";
    if (event.earlyPrelimsTime) {
      const earlyPrelimsTime = new Date(
        parseInt(event.earlyPrelimsTime) * 1000
      );
      const hoursAgo = (+date - +earlyPrelimsTime) / 3600000;
      if (hoursAgo > 0) description += ` (${hoursAgo} hrs before Main)`;
    }
    description += `\n--------------------\n${event.earlyPrelims.join("\n")}\n`;
  }

  description += `\n${event.url}\n`;

  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone: "America/Toronto",
    timeZoneName: "short",
  });
  description += `\nAccurate as of ${timestamp}`;

  const calendarEvent: EventAttributes = {
    start,
    duration,
    title,
    description,
    location: event.location,
    uid: event.url.href,
    calName,
    alarms: [
      {
        action: "display",
        description: `${title} starting soon!`,
        // ✅ ics expects `trigger`, not `triggerBefore`
        //    Use relative trigger with `before: true`
        trigger: { minutes: 30, before: true },
      },
    ],
  };

  return calendarEvent;
}

// Type placeholder to match your scraper outputs
interface UFCEvent {
  name: string;
  date: string;
  location: string;
  url: URL;
  fightCard: string[];
  mainCard: string[];
  prelims: string[];
  earlyPrelims: string[];
  prelimsTime?: string;
  earlyPrelimsTime?: string;
}

createICS();
