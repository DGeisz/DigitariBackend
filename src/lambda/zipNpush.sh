cd dist || exit
zip "$1.zip" -r "$1.js"
aws lambda update-function-code --function-name "$2" --zip-file "fileb://$1.zip"
echo
