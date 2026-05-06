import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Platform, StatusBar as RNStatusBar, Dimensions } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  interpolate, 
  Extrapolation, 
  useAnimatedScrollHandler, 
  FadeInDown, 
  FadeIn,
  interpolateColor
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const ITEM_WIDTH = width * 0.85;
const ITEM_SPACING = (width - ITEM_WIDTH) / 2;

const ONBOARDING_DATA = [
  {
    id: '1',
    type: 'factCard',
    cinematicTitle: 'Pure & Untouched',
    title: 'No Synthetic Chemicals',
    description: 'Organic farming strictly prohibits the use of synthetic pesticides and fertilizers, meaning cleaner food and a healthier ecosystem.',
    avatarTitle: "DID YOU KNOW?",
    avatarSubtitle: 'Protects local water sources',
    floatingImage: require('../assets/images/card_fruit.png')
  },
  {
    id: '2',
    type: 'bentoBox',
    cinematicTitle: 'From the Earth',
    bentoData: {
      topImage: require('../assets/images/bento_greens.png'),
      topText: '100% Pesticide Free',
      bottomLeftImage: require('../assets/images/bento_tomatoes.png'),
      bottomLeftText: 'Non-GMO Certified',
      bottomRightImage: require('../assets/images/bento_carrots.png'),
      bottomRightText: 'Nutrient Rich Soil',
    }
  },
  {
    id: '3',
    type: 'factCard',
    cinematicTitle: 'Peak Nutrition',
    title: 'More Nutrients per Bite',
    description: 'Studies show organic produce contains significantly higher levels of antioxidants, vitamins, and minerals compared to conventional crops.',
    avatarTitle: "NUTRITION FACT",
    avatarSubtitle: 'Up to 60% more antioxidants',
    floatingImage: require('../assets/images/card_veg.png')
  },
  {
    id: '4',
    type: 'bentoBox',
    cinematicTitle: 'Harvested Today',
    bentoData: {
      topImage: require('../assets/images/bento_berries.png'),
      topText: 'Harvested Today',
      bottomLeftImage: require('../assets/images/bento_box.png'),
      bottomLeftText: 'Direct to Door',
      bottomRightImage: require('../assets/images/bento_citrus.png'),
      bottomRightText: 'Vitamin C Boost',
    }
  },
  {
    id: '5',
    type: 'factCard',
    cinematicTitle: 'Community First',
    title: 'Support Local Farmers',
    description: 'By choosing organic buckets, you directly support local sustainable farms that prioritize the health of our communities and soil.',
    avatarTitle: "COMMUNITY IMPACT",
    avatarSubtitle: 'Fair trade & locally sourced',
    floatingImage: require('../assets/images/card_orange.png')
  }
];

const FactCard = ({ item }: any) => {
  return (
    <View style={styles.card}>
      {item.floatingImage && (
        <Image 
          source={item.floatingImage} 
          style={styles.floatingImage} 
          contentFit="cover" 
        />
      )}
      <View style={styles.cardTop}>
        <View style={styles.innerCard}>
          <Image source={require('../assets/images/farmer_avatar.png')} style={styles.avatar} contentFit="cover" />
          <View style={styles.innerCardTextContainer}>
            <Text style={styles.innerCardSubtitle}>{item.avatarTitle}</Text>
            <Text style={styles.innerCardTitle}>{item.avatarSubtitle}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.cardContent}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.badgeOutline}>
          <Ionicons name="leaf" size={14} color="#E67E22" />
          <Text style={styles.badgeTextOutline}>ORGANIC FACT</Text>
        </View>
      </View>
    </View>
  );
};

const BentoBox = ({ item }: any) => {
  const { bentoData } = item;
  return (
    <View style={styles.bentoContainer}>
      <View style={styles.bentoTop}>
        <Image source={bentoData.topImage} style={styles.bentoImageBg} contentFit="cover" />
        <View style={styles.bentoOverlay}>
          <Ionicons name="leaf" size={24} color="#fff" />
          <Text style={styles.bentoTextLarge}>{bentoData.topText}</Text>
        </View>
      </View>
      <View style={styles.bentoBottom}>
        <View style={styles.bentoSquare}>
          <Image source={bentoData.bottomLeftImage} style={styles.bentoImageBg} contentFit="cover" />
          <View style={styles.bentoOverlay}>
            <Text style={styles.bentoTextSmall}>{bentoData.bottomLeftText}</Text>
          </View>
        </View>
        <View style={styles.bentoSquare}>
          <Image source={bentoData.bottomRightImage} style={styles.bentoImageBg} contentFit="cover" />
          <View style={styles.bentoOverlay}>
            <Text style={styles.bentoTextSmall}>{bentoData.bottomRightText}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const OnboardingItem = ({ item, index, scrollX }: any) => {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * ITEM_WIDTH,
      index * ITEM_WIDTH,
      (index + 1) * ITEM_WIDTH,
    ];

    const scale = interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <View style={{ width: ITEM_WIDTH, overflow: 'visible' }}>
      <Animated.View style={[styles.itemWrapper, animatedStyle]}>
        {item.type === 'factCard' ? <FactCard item={item} /> : <BentoBox item={item} />}
      </Animated.View>
    </View>
  );
};

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<any>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const bgAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      [0, (ONBOARDING_DATA.length - 1) * ITEM_WIDTH],
      [0, -50],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }]
    };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = currentIndex < ONBOARDING_DATA.length - 1 ? currentIndex + 1 : 0;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      // Note: We don't update state here. onViewableItemsChanged will naturally 
      // update the state when the scroll finishes, which cleanly restarts this timer!
    }, 4500); 

    return () => clearInterval(interval);
  }, [currentIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0] && viewableItems[0].index !== currentIndexRef.current) {
      currentIndexRef.current = viewableItems[0].index;
      setCurrentIndex(viewableItems[0].index);
      Haptics.selectionAsync();
    }
  }).current;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      console.log('Get Started Pressed');
    }
  };

  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_WIDTH,
    offset: ITEM_WIDTH * index,
    index,
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <Animated.Image 
        source={require('../assets/images/farm_bg.png')} 
        style={[styles.backgroundImage, bgAnimatedStyle]}
      />

      <SafeAreaView style={styles.safeArea}>
        
        <Animated.View entering={FadeInDown.duration(800).delay(100)} style={styles.header}>
          <View style={styles.logoContainer}>
            <FontAwesome5 name="seedling" size={24} color="#3e5c40" />
            <Text style={styles.logoText}>Organica Bucket</Text>
          </View>
        </Animated.View>

        <View style={styles.spacer}>
          {ONBOARDING_DATA.map((item, index) => {
            const animatedTextStyle = useAnimatedStyle(() => {
              const inputRange = [
                (index - 1) * ITEM_WIDTH,
                index * ITEM_WIDTH,
                (index + 1) * ITEM_WIDTH,
              ];
              
              const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
              const translateY = interpolate(scrollX.value, inputRange, [15, 0, -15], Extrapolation.CLAMP);

              return {
                opacity,
                transform: [{ translateY }],
                position: 'absolute',
                width: '100%',
              };
            });

            return (
              <Animated.View key={item.id} style={animatedTextStyle}>
                <Text style={styles.cinematicText}>{item.cinematicTitle}</Text>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View entering={FadeIn.duration(1000).delay(300)} style={styles.carouselContainer}>
          <Animated.FlatList
            ref={flatListRef}
            data={ONBOARDING_DATA}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ITEM_WIDTH}
            snapToAlignment="start" 
            decelerationRate="fast"
            bounces={false}
            contentContainerStyle={{ paddingHorizontal: ITEM_SPACING }} 
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            getItemLayout={getItemLayout}
            renderItem={({ item, index }) => <OnboardingItem item={item} index={index} scrollX={scrollX} />}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(800).delay(500)} style={styles.footer}>
          <View style={styles.pagination}>
            {ONBOARDING_DATA.map((_, index) => {
              const dotAnimatedStyle = useAnimatedStyle(() => {
                const inputRange = [
                  (index - 1) * ITEM_WIDTH,
                  index * ITEM_WIDTH,
                  (index + 1) * ITEM_WIDTH,
                ];
                
                const dotWidth = interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP);
                const backgroundColor = interpolateColor(
                  scrollX.value,
                  inputRange,
                  ['rgba(92, 124, 84, 0.3)', '#5C7C54', 'rgba(92, 124, 84, 0.3)']
                );

                return {
                  width: dotWidth,
                  backgroundColor
                };
              });

              return (
                <Animated.View 
                  key={index} 
                  style={[styles.dot, dotAnimatedStyle]} 
                />
              );
            })}
          </View>

          <TouchableOpacity 
            style={styles.button} 
            activeOpacity={0.8}
            onPress={handleNext}
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4EB', 
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    width: width + 100, 
    left: -50,
    height: height * 0.78, 
    resizeMode: 'cover',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3e5c40', 
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  spacer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cinematicText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#D35400', // Deep Terracotta Orange for contrast
    fontStyle: 'italic',
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(211, 84, 0, 0.2)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  carouselContainer: {
    height: 460,
    paddingBottom: 20,
    overflow: 'visible',
  },
  itemWrapper: {
    height: '100%',
    justifyContent: 'flex-start',
    paddingTop: 45,
    overflow: 'visible',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)', 
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
    minHeight: 380,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    overflow: 'visible',
  },
  floatingImage: {
    position: 'absolute',
    top: -40,
    right: -16,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 10,
    elevation: 5,
  },
  cardTop: {
    marginBottom: 16,
    paddingRight: 50, // Prevents inner text from hitting the floating image
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardBottom: {
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#324A34',
    lineHeight: 34,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#5b6b5b',
    lineHeight: 22,
  },
  innerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcdcc8',
  },
  innerCardTextContainer: {
    flex: 1,
  },
  innerCardSubtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7a8a7a',
    letterSpacing: 1,
    marginBottom: 2,
  },
  innerCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#324A34',
    fontStyle: 'italic',
  },
  badgeOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(230, 126, 34, 0.3)',
    backgroundColor: 'rgba(230, 126, 34, 0.05)',
    gap: 6,
  },
  badgeTextOutline: {
    color: '#E67E22',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  bentoContainer: {
    flex: 1,
    minHeight: 380, 
    gap: 16,
  },
  bentoTop: {
    flex: 1.2,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#3e5c40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  bentoBottom: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  bentoSquare: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E67E22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  bentoImageBg: {
    ...StyleSheet.absoluteFillObject,
  },
  bentoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  bentoTextLarge: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 6,
  },
  bentoTextSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 64,
    gap: 24,
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  button: {
    backgroundColor: '#E67E22', // Vibrant Organic Orange
    width: '100%',
    paddingVertical: 18,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#E67E22', // Glowing shadow
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
