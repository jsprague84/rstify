import { Text as RNText, TextInput as RNTextInput } from 'react-native';

/**
 * Make Inter the base typeface for every <Text>/<TextInput> without editing each
 * component. We PREPEND the family to the style array so NativeWind's per-className
 * styles (size, weight, color) still win, while fontFamily falls through to Inter.
 * Bold/semibold render as synthesized weights on Inter, which is acceptable.
 *
 * The Inter_* fonts are loaded via useFonts() in app/_layout.tsx; import this module
 * for its side effect before the first render.
 */
const BASE = { fontFamily: 'Inter_400Regular' as const };

function patch(Comp: any) {
  if (!Comp || Comp.__interPatched) return;
  const original = Comp.render;
  if (typeof original !== 'function') return;
  Comp.render = function patched(props: any, ref: any) {
    return original.call(this, { ...props, style: [BASE, props?.style] }, ref);
  };
  Comp.__interPatched = true;
}

patch(RNText);
patch(RNTextInput);
