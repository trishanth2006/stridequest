import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function TerritoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <View className="flex-1 items-center justify-center gap-3">
        <Text className="text-2xl font-bold text-white">Territory</Text>
        <Text className="text-sm text-neutral-400">Map coming soon</Text>
      </View>
    </SafeAreaView>
  )
}
