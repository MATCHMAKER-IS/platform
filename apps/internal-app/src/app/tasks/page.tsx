import { TasksClient } from "./tasks-client.js";
export const metadata = { title: "タスク" };
export default function Page() {
  return <TasksClient />;
}
