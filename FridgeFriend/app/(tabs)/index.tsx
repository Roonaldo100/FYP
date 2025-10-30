import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';

//Table setup for fetch error catching
//These types define the expected structure of the data fetched from the backend
type Category = { id: number; name: string };
type FoodType = { id: number; name: string; category: number };


export default function App() {
  //State initialisation. 
  //const [state, functionToUpdateState] = useState<type>(initialValue)
  const [categories, setCategories] = useState<Category[]>([]);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  //Bootup GET request which retrieves category data and converts it to JSON
  useEffect(() => {
    fetch(`${API_BASE_URL}/categories`)
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error(err));
  }, []);

  //Store the selected category and fetch its related food_types
  //async allows use of await, avoiding chained .then() calls
  const handleCategoryPress = async (category: Category) => {
    setLoading(true);
    setSelectedCategory(category);
    try {
      const res = await fetch(`${API_BASE_URL}/categories/${category.id}/food`);
      const data = await res.json();
      setFoodTypes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  //Unset selected category and clear any displayed food type data
  const handleBackPress = () => {
    setSelectedCategory(null);
    setFoodTypes([]);
  };

  //////////////////////////////////////////////////////////////////////////////

  //Dynamically creates the buttons for categories or food types
  //items: array of strings (category or food type names)
  //map() loops through each name in items and for each one creates a pressable button (TouchableOpacity)
  //onPress defines the function that executes when a button is tapped
  const renderButtons = (items: string[], onPress: (name: string) => void) => (
    <View style={styles.grid}>
      {items.map((name, index) => (
        <TouchableOpacity key={index} style={styles.button} onPress={() => onPress(name)}>
          <Text style={styles.buttonText}>{name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  //////////////////////////////////////////////////////////////////////////////

  //Renders the App
  //Dynamically updates the title depending on whether a category has been selected or not
  //Shows a loading spinner while data is being fetched
  //If there's a selected category, render the related food types
  //Else (at startup or after back press), render the category buttons
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {selectedCategory ? `${selectedCategory.name} Types` : 'Select a Category'}
      </Text>

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading &&
        (selectedCategory
          ? renderButtons(foodTypes.map(ft => ft.name), () => {})
          : renderButtons(categories.map(cat => cat.name), (name) => {
              //Find the category object whose name matches the tapped button
              const cat = categories.find(c => c.name === name);
              //If found, fetch and display its food types
              if (cat) handleCategoryPress(cat);
            }))}

      {/* Show back button only when a category is selected */}
      {selectedCategory && (
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      <StatusBar style="auto" />
    </View>
  );
}


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
