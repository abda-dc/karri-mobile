import { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { colors, radii, spacing, touchTargets, typography } from "../theme/tokens";

type InvalidAccessibilityState = TextInputProps["accessibilityState"] & {
  invalid?: boolean;
};

type TextFieldProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  errorText?: string;
  helperText?: string;
  inputStyle?: StyleProp<TextStyle>;
  label: string;
  required?: boolean;
};

export function TextField({
  containerStyle,
  errorText,
  helperText,
  inputStyle,
  label,
  multiline,
  onBlur,
  onFocus,
  required = false,
  style: textInputStyle,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const supportingText = errorText ?? helperText;
  const accessibilityState = errorText
    ? ({ ...props.accessibilityState, invalid: true } as InvalidAccessibilityState)
    : props.accessibilityState;

  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        {...props}
        accessibilityHint={props.accessibilityHint ?? (helperText ? helperText : undefined)}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityState={accessibilityState}
        multiline={multiline}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          errorText && styles.errorInput,
          textInputStyle,
          inputStyle,
        ]}
        textAlignVertical={multiline ? "top" : "center"}
      />
      {supportingText ? (
        <Text style={[styles.supporting, errorText && styles.errorText]}>{supportingText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    ...typography.label,
  },
  required: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  multiline: {
    minHeight: 112,
    paddingTop: spacing.md,
  },
  focused: {
    borderColor: colors.primary,
    borderWidth: 2,
    paddingHorizontal: spacing.md - 1,
  },
  errorInput: {
    borderColor: colors.error,
  },
  supporting: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  errorText: {
    color: colors.error,
  },
});
