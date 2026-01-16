#!/bin/bash
# Script to add dark mode classes to Education.jsx

FILE="/Users/dan/jordiee/src/Education.jsx"

# Backup
cp "$FILE" "$FILE.bak"

# Replace all remaining elements with dark mode variants
sed -i '' 's/text-gray-600 leading-relaxed mb-6 max-w-lg/text-gray-600 dark:text-gray-300 leading-relaxed mb-6 max-w-lg/g' "$FILE"
sed -i '' 's/text-gray-600 leading-relaxed mb-6"/text-gray-600 dark:text-gray-300 leading-relaxed mb-6"/g' "$FILE"
sed -i '' 's/bg-white\/60 backdrop-blur-md border border-white\/40 text-gray-700 shadow-sm hover:bg-white\/80 transition/bg-white\/60 dark:bg-gray-700\/60 backdrop-blur-md border border-white\/40 dark:border-gray-600\/40 text-gray-700 dark:text-gray-200 shadow-sm hover:bg-white\/80 dark:hover:bg-gray-600\/80 transition/g' "$FILE"
sed -i '' 's/bg-white\/80 backdrop-blur-md border border-white\/50 text-sm font-semibold text-gray-700 shadow-md/bg-white\/80 dark:bg-gray-700\/80 backdrop-blur-md border border-white\/50 dark:border-gray-600\/50 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-md/g' "$FILE"
sed -i '' 's/bg-white\/90 backdrop-blur-md border border-white\/50/bg-white\/90 dark:bg-gray-700\/90 backdrop-blur-md border border-white\/50 dark:border-gray-600\/50/g' "$FILE"
sed -i '' 's/text-xs font-semibold text-gray-700 shadow-lg/text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-lg/g' "$FILE"
sed -i '' 's/bg-white\/70 hover:bg-white/bg-white\/70 dark:bg-gray-700\/70 hover:bg-white dark:hover:bg-gray-600/g' "$FILE"
sed -i '' 's/text-gray-900 hover:text-gray-700/text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300/g' "$FILE"

echo "Dark mode classes added to Education.jsx"
