import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconCircleCheckFilled, IconLoader, IconGripVertical, IconDotsVertical, IconClockHour4, IconCheck, IconX, IconAlertTriangle } from "@tabler/icons-react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { XCircle, Clock, Activity } from "lucide-react";
import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconLayoutColumns } from "@tabler/icons-react";

export const Route = createFileRoute("/dashboard/jobs")({
  component: JobsPage,
});

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type Job = {
  id: string;
  type: string;
  status: string;
  isScheduled: boolean;
  createdAt: string | null;
  error: string | null;
};

async function fetchJobs() {
  const response = await fetch(`${API_URL}/api/jobs/list`);
  if (!response.ok) {
    throw new Error("Failed to fetch jobs");
  }
  return response.json();
}

async function fetchUsage() {
  const response = await fetch(`${API_URL}/api/usage`);
  if (!response.ok) {
    throw new Error("Failed to fetch usage");
  }
  return response.json();
}

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({
    id,
  });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}

function DraggableRow({ row }: { row: Row<Job> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  });

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

function JobsTableComponent({ jobs, refetch }: { jobs: Job[]; refetch: () => void }) {
  const [data, setData] = React.useState(() => jobs);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({});

  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  );

  const columns = createColumns(refetch, actionLoading, setActionLoading);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id);
        const newIndex = dataIds.indexOf(over.id);
        return arrayMove(data, oldIndex, newIndex);
      });
    }
  }

  return (
    <div className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2 mb-2">
          <Input
            placeholder="Filter jobs by type..."
            value={(table.getColumn("type")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("type")?.setFilterValue(event.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" && column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger size="sm" className="w-20">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const createColumns = (refetch: () => void, actionLoading: Record<string, boolean>, setActionLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>): ColumnDef<Job>[] => [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <div className="w-32">
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {row.original.type}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-muted-foreground px-1.5">
        {row.original.status === "completed" ? (
          <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400 mr-1" />
        ) : row.original.status === "failed" ? (
          <XCircle className="h-3 w-3 mr-1 text-red-500" />
        ) : row.original.status === "running" ? (
          <IconLoader className="mr-1 animate-spin" />
        ) : row.original.status === "suspended" ? (
          <Clock className="h-3 w-3 mr-1 text-orange-500" />
        ) : (
          <Clock className="h-3 w-3 mr-1 text-yellow-500" />
        )}
        {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
      </Badge>
    ),
  },
  {
    accessorKey: "isScheduled",
    header: "Scheduled",
    cell: ({ row }) => (
      <Badge variant={row.original.isScheduled ? "secondary" : "outline"}>
        {row.original.isScheduled ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleString()
          : "N/A"}
      </span>
    ),
  },
  {
    accessorKey: "error",
    header: "Error",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.error ? (
          <span className="text-red-600 dark:text-red-400 truncate block max-w-xs">
            {row.original.error}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const job = row.original;
      const isLoading = actionLoading[job.id] || false;

      const handleSuspend = async () => {
        setActionLoading(prev => ({ ...prev, [job.id]: true }));
        try {
          const response = await fetch(`${API_URL}/api/jobs/${job.id}/suspend`, {
            method: "POST",
          });
          if (!response.ok) {
            throw new Error("Failed to suspend job");
          }
          refetch();
        } catch (error) {
          console.error("Error suspending job:", error);
          alert("Failed to suspend job");
        } finally {
          setActionLoading(prev => ({ ...prev, [job.id]: false }));
        }
      };

      const handleResume = async () => {
        setActionLoading(prev => ({ ...prev, [job.id]: true }));
        try {
          const response = await fetch(`${API_URL}/api/jobs/${job.id}/resume`, {
            method: "POST",
          });
          if (!response.ok) {
            throw new Error("Failed to resume job");
          }
          refetch();
        } catch (error) {
          console.error("Error resuming job:", error);
          alert("Failed to resume job");
        } finally {
          setActionLoading(prev => ({ ...prev, [job.id]: false }));
        }
      };

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
              size="icon"
              disabled={isLoading}
            >
              <IconDotsVertical />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Retry Job</DropdownMenuItem>
            <DropdownMenuSeparator />
            {job.status === "suspended" ? (
              <DropdownMenuItem onClick={handleResume} disabled={isLoading}>
                Resume Job
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleSuspend} disabled={isLoading || job.status === "completed" || job.status === "failed"}>
                Suspend Job
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

function JobsPage() {
  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
    refetchInterval: 5000,
  });

  const jobs = jobsData?.jobs || [];
  const queue = jobsData?.queue || {};

  // Transform jobs to match the schema
  const jobsForTable = jobs.map((job: any) => ({
    id: String(job.id),
    type: job.type || "Unknown",
    status: job.status || "pending",
    isScheduled: job.isScheduled || false,
    createdAt: job.createdAt || null,
    error: job.error || null,
  }));

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Jobs & Collection</h2>
        <p className="text-muted-foreground">
          Monitor collection jobs and scheduling
        </p>
      </div>

      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-3 lg:grid-cols-5">
        <Card className="@container/card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2 text-xs">
                <IconClockHour4 className="h-3.5 w-3.5 text-yellow-500" />
                Waiting
              </CardDescription>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums mt-2">
              {queue.waiting || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
            Jobs in queue
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2 text-xs">
                <Activity className="h-3.5 w-3.5 text-blue-500" />
                Active
              </CardDescription>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums mt-2">
              {queue.active || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
            Currently processing
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2 text-xs">
                <IconCheck className="h-3.5 w-3.5 text-green-500" />
                Completed
              </CardDescription>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums mt-2">
              {queue.completed || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
            Successfully finished
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2 text-xs">
                <IconX className="h-3.5 w-3.5 text-red-500" />
                Failed
              </CardDescription>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums mt-2">
              {queue.failed || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
            Errors encountered
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2 text-xs">
                <IconAlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                Delayed
              </CardDescription>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums mt-2">
              {queue.delayed || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
            Scheduled for later
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job History</CardTitle>
          <CardDescription>Recent collection jobs and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : jobs.length === 0 ? (
            <Alert>
              <AlertDescription>No jobs found</AlertDescription>
            </Alert>
          ) : (
            <JobsTableComponent jobs={jobsForTable} refetch={refetchJobs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
