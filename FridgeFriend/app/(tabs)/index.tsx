import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';
import { useLocalSearchParams } from 'expo-router';

//Table setup for fetch error catching
//These types define the expected structure of the data fetched from the backend
type Category = { id: number; name: string };
type FoodType = { id: number; name: string; category: number };
type UserProduct = {
  product_id: number;
  product_name: string;
  store_name: string;
  quantity: number;
  nearest_expiry: string;
};

export default function App() {
  //Get user ID passed from login
  const { user_id } = useLocalSearchParams<{ user_id: string }>();

  //State initialisation. 
  //const [state, functionToUpdateState] = useState<type>(initialValue)
  const [categories, setCategories] = useState<Category[]>([]);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [userProducts, setUserProducts] = useState<UserProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFoodType, setSelectedFoodType] = useState<FoodType | null>(null);
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

  //Fetch only the logged-in user's products belonging to the selected food type
  const handleFoodTypePress = async (foodType: FoodType) => {
    if (!user_id) return;
    setLoading(true);
    setSelectedFoodType(foodType);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${user_id}/foodtype/${foodType.id}`);
      const data = await res.json();
      setUserProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  //Unset selected food type or category and clear displayed data
  const handleBackPress = () => {
    if (selectedFoodType) {
      setSelectedFoodType(null);
      setUserProducts([]);
    } else if (selectedCategory) {
      setSelectedCategory(null);
      setFoodTypes([]);
    }
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

  //Render the user's grouped products for a selected food type
  const renderUserProducts = () => (
    <View style={styles.grid}>
      {userProducts.map((prod, index) => (
        <View key={index} style={styles.productCard}>
          <Text style={styles.productName}>{prod.product_name}</Text>
          <Text style={styles.productDetails}>Store: {prod.store_name}</Text>
          <Text style={styles.productDetails}>Qty: {prod.quantity}</Text>
          <Text style={styles.productDetails}>Expires: {prod.nearest_expiry}</Text>
        </View>
      ))}
    </View>
  );

  //////////////////////////////////////////////////////////////////////////////

  //Renders the App
  //Dynamically updates the title depending on whether a category or food type has been selected
  //Shows a loading spinner while data is being fetched
  //If there's a selected category, render the related food types
  //If a food type is selected, show the user's grouped products
  //Else (at startup or after back press), render the category buttons
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {selectedFoodType
          ? `${selectedFoodType.name} (Your Items)`
          : selectedCategory
          ? `${selectedCategory.name} Types`
          : 'Select a Category'}
      </Text>

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading &&
        (selectedFoodType
          ? renderUserProducts()
          : selectedCategory
          ? renderButtons(foodTypes.map(ft => ft.name), (name) => {
              const ft = foodTypes.find(f => f.name === name);
              if (ft) handleFoodTypePress(ft);
            })
          : renderButtons(categories.map(cat => cat.name), (name) => {
              //Find the category object whose name matches the tapped button
              const cat = categories.find(c => c.name === name);
              //If found, fetch and display its food types
              if (cat) handleCategoryPress(cat);
            }))}

      {/* Show back button only when a category or food type is selected */}
      {(selectedCategory || selectedFoodType) && (
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

//////////////////////////////////////////////////////////////////////////////////////////

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
  productCard: {
    backgroundColor: '#fff',
    width: 150,
    borderRadius: 10,
    padding: 10,
    margin: 5,
    alignItems: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  productDetails: {
    fontSize: 14,
    color: '#555',
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
