import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Karri Mobile</Text>
      <Text style={styles.title}>Trusted diaspora shipping starts here.</Text>
      <Text style={styles.subtitle}>
        Senders and travelers will be able to connect, book, and track custody with clarity.
      </Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  eyebrow: {
    color: '#2F6F4E',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#17231B',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#516052',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
});
