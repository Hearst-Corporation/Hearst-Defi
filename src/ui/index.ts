export { ActivityFeed, type ActivityItem } from "./activity-feed";
export { Badge, ProvenanceBadge } from "./badge";
export { Button, buttonVariants, type ButtonProps } from "./button";
// PAS de ré-export des charts ici. `./chart` est "use client" et importe
// recharts : ré-exporté par ce barrel, il entrait dans le bundle de TOUTES les
// routes qui font `from "@/ui"` — y compris /forgot-password et /reset-password,
// qui n'affichent aucun graphique. Les charts s'importent en profond :
//   import { PerformanceChart } from "@/ui/chart";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
export { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
export { Drawer, DrawerTitle } from "./drawer";
export { EmptyState } from "./empty-state";
export { FieldError, Input, Label, Textarea, type InputProps, type TextareaProps } from "./input";
export { Kpi, KpiGrid } from "./kpi";
export { Select, type SelectProps } from "./select";
export { Skeleton, SkeletonText } from "./skeleton";
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
export { Timeline, type TimelineItem } from "./timeline";
export { Toaster } from "./toast";
export { Tooltip } from "./tooltip";
