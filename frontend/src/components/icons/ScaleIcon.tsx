interface ScaleIconProps {
  className?: string;
  size?: number;
}

export function ScaleIcon({ className = "", size = 24 }: ScaleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Base de la balanza */}
      <path
        d="M4 20h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Poste principal */}
      <path
        d="M12 4v14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Barra horizontal */}
      <path
        d="M6 8h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Plato izquierdo */}
      <path
        d="M6 8l-2 6h4l-2-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      
      {/* Plato derecho */}
      <path
        d="M18 8l-2 6h4l-2-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      
      {/* Cadenas */}
      <path
        d="M6 8v1M18 8v1"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      
      {/* Decoración superior */}
      <circle
        cx="12"
        cy="4"
        r="1"
        fill="currentColor"
      />
    </svg>
  );
}