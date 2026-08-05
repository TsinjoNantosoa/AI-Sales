import { getInitials, getAvatarColor, cn } from "@/lib/utils";

interface AvatarProps {
  firstName: string;
  lastName: string;
  id?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function UserAvatar({ firstName, lastName, id = "", size = "sm", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white shrink-0",
        sizeMap[size],
        getAvatarColor(id || firstName),
        className
      )}
    >
      {getInitials(firstName, lastName)}
    </div>
  );
}
