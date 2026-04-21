import { SafeAreaView } from "react-native-safe-area-context";
import { cssInterop } from "nativewind";

cssInterop(SafeAreaView, {
  className: {
    target: "style",
  },
});

/**
 * Wraps screen content with safe-area insets (status bar, notches, home indicator).
 * Pass `edges` to limit which sides apply (e.g. omit bottom when a tab bar handles it).
 */
export function SafeScreen({
  children,
  edges = ["top", "left", "right", "bottom"],
  style,
  className = "flex-1 bg-white",
  ...rest
}) {
  return (
    <SafeAreaView
      className={className}
      style={style}
      edges={edges}
      {...rest}
    >
      {children}
    </SafeAreaView>
  );
}
