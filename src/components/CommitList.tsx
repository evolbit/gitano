import { IconFilter, IconPlus, IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import InputText from "./form/InputText";
import TableVirtualResizable, {
  TableColumn,
} from "./tables/TableVirtualResizable";

// Datos hardcodeados de ejemplo
const data = [
  {
    id: "abc123",
    sha: "abc123",
    mensaje: "🔧 Fix login bug",
    autor: "Alice",
    rama_actual: "main",
    rama_origen: "feature/login",
    pr: "#42",
    mergeado_en: "main",
    archivos: 3,
    ci: "success",
  },
  {
    id: "def456",
    sha: "def456",
    mensaje: "✨ Add step",
    autor: "Bob",
    rama_actual: "develop",
    rama_origen: "feature/checkout",
    pr: "",
    mergeado_en: "",
    archivos: 5,
    ci: "failed",
  },
  // Puedes agregar más datos para probar el scroll
];

function StatusBadge({ status }: { status: string }) {
  let color = "text-green-400";
  let dot = "bg-green-400";
  let label = "Completado";
  if (status === "failed") {
    color = "text-red-400";
    dot = "bg-red-400";
    label = "Fallido";
  } else if (status === "pending") {
    color = "text-yellow-400";
    dot = "bg-yellow-400";
    label = "Pendiente";
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 bg-zinc-800/70 rounded-full px-3 py-0.5 text-sm font-medium min-w-[90px] justify-center ${color}`}>
      <span className={`w-2.5 h-2.5 rounded-full inline-block ${dot}`} />
      {label}
    </span>
  );
}

export default function CommitList() {
  const [search, setSearch] = useState("");

  // Definir columnas con render personalizado para CI
  const columns: TableColumn<(typeof data)[0]>[] = [
    { key: "sha", label: "SHA", width: 120 },
    { key: "mensaje", label: "Mensaje", width: 250 },
    { key: "autor", label: "Autor", width: 120 },
    { key: "rama_actual", label: "Rama actual", width: 120 },
    { key: "rama_origen", label: "Rama de origen", width: 140 },
    { key: "pr", label: "PR", width: 80 },
    { key: "mergeado_en", label: "Mergeado en", width: 120 },
    { key: "archivos", label: "Archivos", width: 80 },
    {
      key: "ci",
      label: "CI",
      width: 90,
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  return (
    <div className="h-full w-full flex flex-col">
      {/* Barra superior */}
      <div className="flex items-center px-4 pt-4 pb-2 border-b border-zinc-800">
        <InputText
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar commit..."
          className="flex-1 bg-zinc-800 rounded-lg px-3 h-9 mr-4"
          leftIcon={
            <IconSearch
              size={18}
              className="text-zinc-400"
            />
          }
        />
        <button className="flex items-center bg-zinc-800 text-white border-none rounded-lg px-3 h-9 mr-2 cursor-pointer font-medium text-[15px]">
          <IconFilter
            size={18}
            className="mr-1.5"
          />
          Filtros
        </button>
        <button className="flex items-center bg-indigo-500 text-white border-none rounded-lg px-4 h-9 cursor-pointer font-medium text-[15px]">
          <IconPlus
            size={18}
            className="mr-1.5"
          />
          Añadir manualmente
        </button>
      </div>
      {/* Tabla reutilizable */}
      <TableVirtualResizable
        columns={columns}
        data={data}
        rowHeight={56}
      />
    </div>
  );
}
