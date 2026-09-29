import { db } from "@/lib/db";
import { compareDue, computeDue } from "@/lib/schedule";

/** All active PM tasks on active assets, with due info, most urgent first. */
export async function getScheduledTasks() {
  const tasks = await db.pmTask.findMany({
    where: { active: true, asset: { status: "ACTIVE" } },
    include: { asset: true },
  });
  const now = new Date();
  return tasks
    .map((task) => ({ task, due: computeDue(task, task.asset.currentMeter, now) }))
    .sort((a, b) => compareDue(a.due, b.due));
}
