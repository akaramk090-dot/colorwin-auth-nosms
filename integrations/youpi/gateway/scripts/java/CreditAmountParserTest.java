import com.youpi.observer.CreditAmountParser;
public class CreditAmountParserTest {
 public static void main(String[] args){String[] cases={"Received 100 rs from Sender","SALMAN paid you ₹100.00","Received Rs. 1,000.50","Received INR 100","Ref 006141840477","deposited in Union Bank -5760 on 22 October at 6:36 PM"};double[] amounts={100,100,1000.50,100,0,0};for(int i=0;i<cases.length;i++){if(CreditAmountParser.parse(cases[i])!=amounts[i])throw new AssertionError(cases[i]);}System.out.println("6 Java notification parser cases passed");}
}
