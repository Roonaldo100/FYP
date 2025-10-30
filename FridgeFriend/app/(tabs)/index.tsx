
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

// Each key (category name) maps to an array of strings (items in that category)
type CategoryData = {
  [key: string]: string[];
};

export default function App() {
  // Hard-coded data for initial testing and layout setup
  // Each category contains a list of example items
  const data: CategoryData = {
    Fruit: ['Apples', 'Bananas', 'Strawberries'],
    Vegetables: ['Carrots', 'Broccoli', 'Spinach'],
    Meat: ['Steak', 'Chicken', 'Pork'],
    Dairy: ['Milk', 'Cheese', 'Yoghurt'],
    Drinks: ['Water', 'Juice', 'Soda'],
    'Dips/Sauces': ['Ketchup', 'Mayo'],
    Snacks: ['Crisps', 'Popcorn'],
    Other: ['Eggs'],
  };

  // State to track which category is currently selected
  // Null means the user is viewing the main category menu
  // const [var, funcToChangeVar] = useState<possibleState1 | possibleState1>(initialstate)
  // selected category can be either a string or null. Null is the initial state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Handle when a category button is pressed
  // function takes in a name argument and calls to setSelectedCategory with that argument
  const handleCategoryPress = (name: string): void => {
    setSelectedCategory(name);
  };

  // Handle the "Back" button press
  // Resets the selected category to null, showing the category list again
  const handleBackPress = (): void => {
    setSelectedCategory(null);
  };

  // Helper function to render a grid of buttons (either categories or items)
  // Takes an array of strings (items) and a function (onPress) that defines what happens when each button is pressed
  // The onPress prop uses an arrow function () => onPress(name) so the handler only runs when the user actually taps the button
  // Each button calls the provided onPress function with its own name
  const renderButtons = (
    items: string[],
    onPress: (name: string) => void
  ) => (
    <View style={styles.grid}>
      {items.map((name, index) => (
        <TouchableOpacity
          key={index}
          style={styles.button}
          onPress={() => onPress(name)}
        >
          <Text style={styles.buttonText}>{name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Display title text — changes based on whether a category is selected */}
      <Text style={styles.title}>
        {selectedCategory ? `${selectedCategory} Types` : 'Select a Category'}
      </Text>

      {/* If a category is selected, render with data (categoryItems)values which are not pressable
          Otherwise, render with data(categoryItems)keys and allow them to be pressed*/}
      {selectedCategory
        ? renderButtons(data[selectedCategory], () => {})
        : renderButtons(Object.keys(data), handleCategoryPress)}

      {/* Back button only appears when inside a category */}
      {selectedCategory && (
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

// App styling for layout, colors, and button design
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#663399',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: 'white',
    fontSize: 22,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 320,
  },
  button: {
    backgroundColor: '#ffcc00',
    width: 150,
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
  },
  buttonText: {
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#663399',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
