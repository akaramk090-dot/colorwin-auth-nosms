package com.youpi.observer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
public final class CreditAmountParser {
 private static final Pattern PREFIX=Pattern.compile("(?:Rs[.]?|INR|₹)\\s*[:]?\\s*([0-9,]+(?:[.][0-9]{1,2})?)",Pattern.CASE_INSENSITIVE);
 private static final Pattern SUFFIX=Pattern.compile("([0-9,]+(?:[.][0-9]{1,2})?)\\s*(?:Rs[.]?|INR|rupees)\\b",Pattern.CASE_INSENSITIVE);
 public static double parse(String text){if(text==null)return 0;Matcher m=PREFIX.matcher(text);if(!m.find()){m=SUFFIX.matcher(text);if(!m.find())return 0;}try{double n=Double.parseDouble(m.group(1).replace(",",""));return n>0&&n<=1000000?n:0;}catch(Exception e){return 0;}}
}
