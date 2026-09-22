import { clearScreenDown, cursorTo, moveCursor } from "node:readline";
import type { IngestionLiveStats } from "./ingest.js";

type Stage = IngestionLiveStats["stage"] | "complete" | "failed";

interface DisplayStats extends Omit<IngestionLiveStats, "stage"> {
  stage: Stage;
  mailboxTotal: number | null;
  retries: number;
}

const numberFormat = new Intl.NumberFormat("en-US");

function formatNumber(value: number | null): string {
  return value == null ? "—" : numberFormat.format(value);
}

function fit(label: string, value: string, width: number): string {
  const content = ` ${label.padEnd(15)} ${value}`;
  return `│${content.slice(0, width - 2).padEnd(width - 2)}│`;
}

export class TerminalIngestionStats {
  private readonly startedAt = Date.now();
  private renderedLines = 0;
  private lastMessage = "Preparing ingestion";
  private readonly stats: DisplayStats = {
    stage: "starting",
    mailboxTotal: null,
    page: 0,
    iteration: 0,
    discovered: 0,
    existing: 0,
    pending: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    retries: 0,
  };

  setMailboxTotal(total: number | null): void {
    this.stats.mailboxTotal = total;
    this.render();
  }

  update(message: string, update: Partial<IngestionLiveStats> = {}): void {
    Object.assign(this.stats, update);
    this.lastMessage = message;
    this.render();
  }

  retry(message: string): void {
    this.stats.retries += 1;
    this.lastMessage = message;
    this.render();
  }

  complete(): void {
    this.stats.stage = "complete";
    this.lastMessage = "Ingestion completed successfully";
    this.render();
    this.renderedLines = 0;
    process.stdout.write("\n");
  }

  fail(message: string): void {
    this.stats.stage = "failed";
    this.lastMessage = message;
    this.render();
    this.renderedLines = 0;
    process.stdout.write("\n");
  }

  private render(): void {
    const elapsedSeconds = Math.floor((Date.now() - this.startedAt) / 1_000);
    const elapsed = `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;
    const width = 74;
    const title = " Gmail ingestion ";
    const top = `╭${title}${"─".repeat(width - title.length - 2)}╮`;
    const bottom = `╰${"─".repeat(width - 2)}╯`;
    const lines = [
      top,
      fit("Stage", this.stats.stage.replaceAll("_", " "), width),
      fit("Mailbox total", formatNumber(this.stats.mailboxTotal), width),
      fit("Pages", formatNumber(this.stats.page), width),
      fit("Iteration", formatNumber(this.stats.iteration), width),
      fit("IDs discovered", formatNumber(this.stats.discovered), width),
      fit("In Supabase", formatNumber(this.stats.existing), width),
      fit("Pending fetch", formatNumber(this.stats.pending), width),
      fit("Inserted", formatNumber(this.stats.inserted), width),
      fit("Updated", formatNumber(this.stats.updated), width),
      fit("Skipped", formatNumber(this.stats.skipped), width),
      fit("Deleted", formatNumber(this.stats.deleted), width),
      fit("Quota retries", formatNumber(this.stats.retries), width),
      fit("Elapsed", elapsed, width),
      fit("Latest", this.lastMessage, width),
      bottom,
    ];

    if (!process.stdout.isTTY) {
      process.stdout.write(`${this.lastMessage}\n`);
      return;
    }
    if (this.renderedLines > 0) {
      moveCursor(process.stdout, 0, -this.renderedLines);
      cursorTo(process.stdout, 0);
      clearScreenDown(process.stdout);
    }
    process.stdout.write(`${lines.join("\n")}\n`);
    this.renderedLines = lines.length;
  }
}
