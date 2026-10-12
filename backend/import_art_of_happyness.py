import os
import sys
import uuid
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_project.settings')
django.setup()

from django.utils import timezone
from attendance_api.models import Student, Event, EventPass, AttendanceSession

RAW_CSV = """Name ,Roll No .,Email,Semester,Section
BHAVANA KUMARI,25EJCIT035,bhavanakumari.it29@jecrc.ac.in,3rd,
GORANSHI AGRAWAL,25EJCIT058,goranshiagrawal.it29@jecrc.ac.in,3rd,
HARSHIT GOYAL,25EJCIT067,harshitgoyal.it29@jecrc.ac.in,3rd,
KHUSHI BINDAL,25EJCIT086,khushibindal.it29@jecrc.ac.in,3rd,
KRISHA SHAH,25EJCIT088,krishashah.it29@jecrc.ac.in,3rd,
MAHAK,25EJCIT098,mahak.it29@jecrc.ac.in,3rd,
MANASVI BHARGAVA,25EJCIT099,manasvibhargava.it29@jecrc.ac.in,3rd,
MANYA MANGAL,25EJCIT100,manyamangal.it29@jecrc.ac.in,3rd,
MITUSHI AGARWAL,25EJCIT102,mitushiagarwal.it29@jecrc.ac.in,3rd,
MOHANSHI JAIN,25EJCIT105,mohanshijain.it29@jecrc.ac.in,3rd,
MUSKAN CHHABRA,25EJCIT108,muskanchhabra.it29@jecrc.ac.in,3rd,
NIYATI SINGH,25EJCIT118,niyatisingh.it29@jecrc.ac.in,3rd,
PALAK TAILOR,25EJCIT119,palaktailor.it29@jecrc.ac.in,3rd,
PARITA JIAN,25EJCIT121,paritajian.it29@jecrc.ac.in,3rd,
PRIYANSHI JAIN,25EJCIT131,priyanshijain.it29@jecrc.ac.in,3rd,
Ayush,24EJCIT037,ayush.it28@jecrc.ac.in,5rd,
Chetan saini,24EJCIT048,chetansaini.it28@jecrc.ac.in,5rd,
Deepak yadav,24EJCIT054,deepakyadav.it28@jecrc.ac.in,5rd,
Snigdh Jain,24EJCIT172,snigdhjain.it28@jecrc.ac.in,5rd,
Yogesh Sharma,24EJCIT189,yogeshsharma.it28@jecrc.ac.in,5rd,
Aashish parsoya,23EJCAD006,aashishparsoya.ai29@jecrc.ac.in,3rd,A
Abhay jangid,25EJCAD008,abhayjangid.ai29@jecrc.ac.in,3rd,A
Aman danodia,25EJCAD017,amandanodia.ai29@jecrc.ac.in,3rd,A
Amit Singh,25EJCAD018,amitsingh.ai29@jecrc.ac.in,3rd,A
Anuj Sharma,25EJCAD021,anujsharma2k7@gmail.com,3rd,A
Arun Choudhary,25EJCAD026,arunchoudhary.ai29@jecrc.ac.in,3rd,A
Aryan Gupta,25EJCAD028,aryangupta.ai29@jecrc.ac.in,3rd,A
ATUL NAGAR,25EJCAD034,atulnagar.ai29@jecrc.ac.in,3rd,A
DHANI GARG,25EJCAD054,dhanigarg.ai29@jecrc.ac.in,3rd,A
Dipendra Choudhary,25EJCAD060,choudharydipendra1@gmail.com,3rd,A
Diya Panwar,25EJCAD065,diyapanwar.ai29@jecrc.ac.in,3rd,A
GAUTAM PRAJAPATI,25EJCAD069,gautamprajapati.ai29@jecrc.ac.in,3rd,B
Hanish Jain,25EJCAD070,hanishjain.ai29@jecrc.ac.in,3rd,B
Harsh Bairwa,25EJCAD072,harshbairwa.ai29@jecrc.ac.in,3rd,B
Harsh kumar jangid,25EJCAD073,harshkumarjangid.ai29@jecrc.ac.in,3rd,B
Harshita Gupta,25EJCAD078,harshitagupta.ai29@jecrc.ac.in,3rd,B
Hemant Mehta,25EJCAD080,hemantmehta.ai29@jecrc.ac.in,3rd,B
Hetal Agarwal,25EJCAD081,hetalagarwal.ai29@jecrc.ac.in,3rd,B
Himank Manjul Sharma,25EJCAD082,himankmanjulsharma.ai29@jecrc.ac.in,3rd,B
HIMANSHU MALVIYA,25EJCAD083,himanshumalviya.ai29@jecrc.ac.in,3rd,B
Hitansh Jain,25EJCAD084,hitanshjain.ai29@jecrc.ac.in,3rd,B
Honey Agarwal,25EJCAD087,honeyagarwal.ai29@jecrc.ac.in,3rd,B
Ishita khatri,25EJCAD089,ishitakhatri.ai29@jecrc.ac.in,3rd,B
Jahanvi Goswami,25EJCAD091,jahanvigoswami.ai29@jecrc.ac.in,3rd,B
Janhvi Gupta,25EJCAD092,janhvigupta.ai29@jecrc.ac.in,3rd,B
Janvi Jain,25EJCAD093,janvijain.ai29@jecrc.ac.in,3rd,B
Jeenat,25EJCAD094,jeenat.ai29@jecrc.ac.in,3rd,B
Jinesh Jain,25EJCAD095,jineshjain.ai29@jecrc.ac.in,3rd,B
Kailash Choudhary,25EJCAD096,kailashchoudhary.ai29@jecrc.ac.in,3rd,B
Kanika Tikkiwal,25EJCAD097,kanikatikkiwal.ai29@jecrc.ac.in,3rd,B
Karan Sankhala,25EJCAD098,karansankhala.ai29@jecrc.ac.in,3rd,B
kavya jain,25EJCAD099,kavyajain.ai29@jecrc.ac.in,3rd,B
Keshav Kumawat,25EJCAD101,keshavkumawat3942@gmail.com,3rd,B
KHAGESH KUMAR YADAV,25EJCAD102,khageshkumaryadav.ai29@jecrc.ac.in,3rd,B
Khush Manihar,25EJCAD103,khushmanihar.ai29@jecrc.ac.in,3rd,B
Khushal Saini,25EJCAD104,khushalsaini2.ai29@jecrc.ac.in,3rd,B
Khushal Saini,25EJCAD105,khushalsaini.ai29@jecrc.ac.in,3rd,B
KRISH,25EJCAD106,raokrish1121@gmail.com,3rd,B
Krishna Joshi,25EJCAD107,krishnajoshi.ai29@jecrc.ac.in,3rd,B
Kulshrest sharma,25EJCAD108,Kulshrestsharma.ai29@jecrc.ac.in,3rd,B
Kundan Singh Shekhawat,25EJCAD111,kundansinghshekhawat.ai29@jecrc.ac.in,3rd,B
Kushal Khatri,25EJCAD112,kushalkhatri.ai29@jecrc.ac.in,3rd,B
Lakita jangir,25EJCAD113,lakita.ai29@jecrc.ac.in,3rd,B
Lavanya,25EJCAD114,lavanya.ai29@jecrc.ac.in,3rd,B
Lavish Agrawal,25EJCAD115,lavishagrawal.ai29@jecrc.ac.in,3rd,B
Lokendra Singh Shekhawat,25EJCAD116,lokendrasinghshekhawat01@gmail.com,3rd,B
Luv Raj,25EJCAD118,luvraj.ai29@jecrc.ac.in,3rd,B
Mahak Gupta,25EJCAD119,mahakgupta.ai29@jecrc.ac.in,3rd,B
Makshita Saini,25EJCAD120,makshitasaini.ai29@jecrc.ac.in,3rd,B
Manish Nyol,25EJCAD121,manishnyol.ai29@jecrc.ac.in,3rd,B
Mansi Kumawat,25EJCAD123,mansikumawat.ai29@jecrc.ac.in,3rd,B
Mayank Matolia,25EJCAD125,mayankmatolia2319@gmail.com,3rd,B
meet Agrawal,25EJCAD127,meetagarwal.ai29@jecrc.ac.in,3rd,B
Monit Soni,25EJCAD136,monitsoni.ai29@jecrc.ac.in,3rd,C
Moulik Joshi,25EJCAD137,moulikjoshi.ai29@jecrc.ac.in,3rd,C
Nagendra Singh Shekhawat,25EJCAD141,nagendrasighshekhawat.ai29@jecrc.ac.in,3rd,C
Narayan Agarwal,25EJCAD145,narayanagarwal30078@gmail.com,3rd,C
Nitya Balani,25EJCAD154,nityabalani.ai29@jecrc.ac.in,3rd,C
Parv Vijayvargiya,25EJCAD164,parvvijayvargiya.ai29@jecrc.ac.in,3rd,C
Pihu,25EJCAD165,pihu.ai29@jecrc.ac.in,3rd,C
Piyush Sharma,25EJCAD169,piyushsharma.ai29@jecrc.ac.in,3rd,C
Prakhar Vagrecha,25EJCAD171,prakharvagrecha.ai29@jecrc.ac.in,3rd,C
Pranav Gaur,25EJCAD172,pranavgaur.ai29@jecrc.ac.in,3rd,C
Priyanshu Singh Hada,25EJCAD179,priyanshusinghhada.ai29@jecrc.ac.in,3rd,C
Rachit Khandelwal,25EJCAD182,rachitkhandelwal.ai29@jecrc.ac.in,3rd,C
R. Sri keerti,25EJCAD193,rkeerti2600@gmail.com,3rd,C
Riddam Goyal,25EJCAD194,riddamgoyal.ai29@jecrc.ac.in,3rd,C
ROHIT SINGH,25EJCAD197,rohitsingh.ai29@jecrc.ac.in,3rd,C
Saket Jaiswal,25EJCAD203,saketjaiswal.ai29@jecrc.ac.in,3rd,D
SAKSHAM BHARDWAJ,25EJCAD204,sakshambhardwaj.ai29@jecrc.ac.in,3rd,D
Samsher Alam,25EJCAD207,samsheralam.ai29@jecrc.ac.in,3rd,D
Shashank Bhimwal,25EJCAD211,shashankbhimwal.ai29@jecrc.ac.in,3rd,D
Shreeyansh,25EJCAD216,shreeyansh.ai29@jecrc.ac.in,3rd,D
Somay Jain,25EJCAD223,somayjain.ai29@jecrc.ac.in,3rd,D
Somya Kumawat,25EJCAD224,somyakumawat.ai29@jecrc.ac.in,3rd,D
Sudhanshu Choudhary,25EJCAD227,sudhanshuchoudhary.ai29@jecrc.ac.in,3rd,D
Suraj Choudhary,25EJCAD230,surajchoudhary.ai29@jecrc.ac.in,3rd,D
SURAJ SHARMA,25EJCAD231,surajsharma.ai29@jecrc.ac.in,3rd,D
SURENDRA CHOUDHARY,25EJCAD232,surendrachoudhary.ai29@jecrc.ac.in,3rd,D
Tanvi Gurjar,25EJCAD237,Tanvigurjar.ai29@jecrc.ac.in,3rd,D
Uday Malav,25EJCAD239,udaymalav.ai29@jecrc.ac.in,3rd,D
Ujjawal Sharma,25EJCAD240,ujjawalsharma.ai29@jecrc.ac.in,3rd,D
Vikas Yadav,25EJCAD242,vikasyadav.ai29@jecrc.ac.in,3rd,D
Vinit kumar Bhatkariya,25EJCAD243,vinitkumarbhatkariya.ai29@jecrc.ac.in,3rd,D
Vinita,25EJCAD244,vinita.ai29@jecrc.ac.in,3rd,D
Vitthal Soni,25EJCAD246,vitthalsoni.ai29@jecrc.ac.in,3rd,D
Yash saini,25EJCAD250,yashsaini.ai29@jecrc.ac.in,3rd,D
Yashvendra bhardwaj,25EJCAD251,yashvendrabhardwaj.ai29@jecrc.ac.in,3rd,D
Granth Gupta,25EJCAD800,granthgupta.ai29@jecrc.ac.in,3rd,D
Tapasya Solanki,25EJCAD803,tapasyasolanki.ai29@jecrc.ac.in,3rd,D
Deepak Verma,null,deepakvermadlp@gmail.com,3rd,D
Vishvajeet Singh,Null,vishvajeetfaujdar2006@gmail.com,3rd,D
AADITYA JANGIR,25EJCEC002,aadityajangir.ece29@jecrc.ac.in,3rd,
ABHAY LAXKAR,25EJCEC006,abhaylaxkar.ece29@jecrc.ac.in,3rd,
ABHAY SINGH SHEKHAWAT,25EJCEC007,Abhaysinghshekhawat.ece29@jecrc.ac.in,3rd,
ABHINAV MATHUR,25EJCEC009,abhinavmathur.ece29@jecrc.ac.in,3rd,
ABHISHEK,25EJCEC011,abhishek.ece29@jecrc.ac.in,3rd,
ADITYA AGARWAL,25EJCEC012,adityaagarwal.ece29@jecrc.ac.in,3rd,
AKSHARA AGRAWAL,25EJCEC017,aksharaagrawal.ece29@jecrc.ac.in,3rd,
AMAN JAGETIYA,25EJCEC018,amanjagetiya.ece29@jecrc.ac.in,3rd,
AMNA SALEEM,25EJCEC019,amnasaleem.ece29@jecrc.ac.in,3rd,
ANSHUL PUROHIT,25EJCEC022,anshulpurohit.ece29@jecrc.ac.in,3rd,
ANUSHKA JADON,25EJCEC023,anushkajadon.ece29@jecrc.ac.in,3rd,
ANUSHKA JAIN,25EJCEC024,anushkajain.ece29@jecrc.ac.in,3rd,
APURVA GUPTA,25EJCEC025,apurvagupta.ece29@jecrc.ac.in,3rd,
ARPIT GUPTA,25EJCEC026,arpitgupta.ece29@jecrc.ac.in,3rd,
AYAN SAINI,25EJCEC028,ayansaini.ece29@jecrc.ac.in,3rd,
AYUSHI JANGAM,25EJCEC029,ayushijangam.ece29@jecrc.ac.in,3rd,
BHAVESH PARWANI,25EJCEC031,bhaveshparwani.ece29@jecrc.ac.in,3rd,
BHAVY JAIN,25EJCEC032,bhavyjain.ece29@jecrc.ac.in,3rd,
BHAVYA JAIN,25EJCEC033,bhavyajain.ece29@jecrc.ac.in,3rd,
BHAVYATA JAISWAL,25EJCEC034,bhavyatajaiswal.ece29@jecrc.ac.in,3rd,
BHOUTIK AGARWAL,25EJCEC036,bhoutikagarwal.ece29@jecrc.ac.in,3rd,
BHUMIKA KUMARI,25EJCEC037,bhumikakumari.ece29@jecrc.ac.in,3rd,
BHUPENDRA SAHU,25EJCEC038,bhupendrasahu.ece29@jecrc.ac.in,3rd,
CHANDAN VAISHNAV,25EJCEC039,chandanvaishnav.ece29@jecrc.ac.in,3rd,
CHHAVI AGRAWAL,25EJCEC040,chhaviagrawal.ece29@jecrc.ac.in,3rd,
DEEPANSHU TIWARI,25EJCEC042,deepanshutiwari.ece29@jecrc.ac.in,3rd,
DINESH,25EJCEC047,dinesh.ece29@jecrc.ac.in,3rd,
DISHA JINDAL,25EJCEC048,dishajindal.ece29@jecrc.ac.in,3rd,
DIVYANSHU SHARMA,25EJCEC051,Divyanshusharma.ece29@jecrc.ac.in,3rd,
GARISHMA GAHLOT,25EJCEC052,garishmagahlot.ece29@jecrc.ac.in,3rd,
GAURAV SINGH SHEKHAWAT,25EJCEC054,gauravsinghshekhawat.ece29@jecrc.ac.in,3rd,
GAURVI SINGH,25EJCEC055,gaurvisingh.ece29@jecrc.ac.in,3rd,
GUNIN AMETA,25EJCEC058,guninameta.ece29@jecrc.ac.in,3rd,
HARSH SAGAR,25EJCEC059,harshsagar.ece29@jecrc.ac in,3rd,
HARSH VARDHAN GUPTA,25EJCEC060,harshvardhangupta.ece29@jecrc.ac.in,3rd,
HARSH VARDHAN THAIYA,25EJCEC061,harshvardhanthaiya.ece29@jecrc.ac.in,3rd,
HARSHIT SHARMA,25EJCEC062,harshitsharma.ece29@jecrc.ac.in,3rd,
Himanshu Gour,25EJCEC064,himanshugour.ece29@jecrc.ac.in,3rd,
Himanshu Mittal,25EJCEC065,himanshumittal.ece29@jecrc.ac.in,3rd,
Himanshu Sharma,25EJCEC066,himanshusharma.ece29@jecrc.ac.in,3rd,
HIMANSHU SINGH NIRWAN,25EJCEC067,himanshusinghnirwan.ece29@jecrc.ac.in,3rd,
Kush,25EJCEC081,kush.ece29@jecrc.ac.in,3rd,
Kushagra Jain,25EJCEC082,kushagrajain.ece29@jecrc.ac.in,3rd,
Lakshit Jain,25EJCEC083,lakshitjain.ece29@jecrc.ac.in,3rd,
Manav Jain,25EJCEC090,manavjain.ece29@jecrc.ac.in,3rd,
MANISH MEWARA,25EJCEC091,manishmewara.ece29@jecrc.ac.in,3rd,
MANSOOR ALI KHAN,25EJCEC093,mansooralikhan.ece29@jecrc.ac.in,3rd,
MAYANK YADAV,25EJCEC097,mayankyadav.ece29@jecrc.ac.in,3rd,
Miral gehlot,25EJCEC098,miralgehlot.ece29@jecrc.ac.in,3rd,
NAVEDHYA PAREEK,25EJCEC100,navedhyapareek.ece29@jecrc.ac.in,3rd,
Nitin Kumar,25EJCEC103,nitinkumar.ece29@jecrc.ac.in,3rd,
Nitin Sharma,25EJCEC105,nitinsharma.ece29@jecrc.ac.in,3rd,
Pal agrawal,25EJCEC106,palagarwal.ece29@jecrc.ac.in,3rd,
PIYUSH CHOUDHARY,25EJCEC107,piyushchoudhary.ece29@jecrc.ac.in,3rd,
Piyush Choudhary,25EJCEC108,piyushchoudhary2.ece29@jecrc.ac.in,3rd,
Piyush Saini,25EJCEC109,piyushsaini.ece29@jecrc.ac.in,3rd,
Prachi Vaishnav,25EJCEC112,prachivaishnav.ece29@jecrc.ac.in,3rd,
Prashasti Agrawal,25EJCEC114,prashastiagrawal.ece29@jecrc.ac.in,3rd,
Priyanshi Kanwar,25EJCEC115,priyanshikanwar.ece29@jecrc.ac.in,3rd,
Priyanshi sethi,25EJCEC116,priyanshisethi.ece29@jecrc.ac.in,3rd,
PURVANSH GUPTA,25EJCEC117,purvanshgupta.ece29@jecrc.ac.in,3rd,
RADHIKA GARG,25EJCEC121,radhikagarg.ece29@jecrc.ac.in,3rd,
Rahul Choudhary,25EJCEC123,rahulchoudhary.ece29@jecrc.ac.in,3rd,
Raj Bisht,25EJCEC125,rajbisht.ece29@jecrc.ac.in,3rd,
Rashi Singh,25EJCEC126,rashisingh.ece29@jecrc.ac.in,3rd,
RIYA KHANDELWAL,25EJCEC131,riyakhandelwal.ece29@jecrc.ac.in,3rd,
ROOPAL KHANDELWAL,25EJCEC133,roopalkhandelwal.ece29@jecrc.ac.in,3rd,
RUDRANSH AGARWAL,25EJCEC134,rudranshagarwal.ece29@jecrc.ac.in,3rd,
SANIYA SHARMA,25EJCEC138,saniyasharma.ece29@jecrc.ac.in,3rd,
SARA KUMAWAT,25EJCEC139,sarakumawat.ece29@jecrc.ac.in,3rd,
VIKAS KUMAR,25EJCEC176,vikaskumar.ece29@jecrc.ac.in,3rd,
ARYAN VERMA,25EJCME001,aryanverma.mech29@jecrc.ac.in,3rd,
ATHARVA DUTTA,25EJCME002,atharvadutta.mech29@jecrc.ac.in,3rd,
CHARANDAS SHEKHAWAT,25EJCME004,charandasshekhawat.mech29@jecrc.ac.in,3rd,
CHIRAG SHARMA,25EJCME005,chiragsharma.mech29@jecrc.ac.in,3rd,
DAKSH PANDEY,25EJCME006,dakshpandey.mech29@jecrc.ac.in,3rd,
DEEPAK SAINI,25EJCME007,deepaksaini.mech29@jecrc.ac.in,3rd,
KUSHAGRYA JANGID,25EJCME010,kushagryajangid.mech29@jecrc.ac.in,3rd,
MANAS GOYAL,25EJCME011,manasgoyal.mech29@jecrc.ac.in,3rd,
MINAKSHI RATHORE,25EJCME012,minakshirathore.mech29@jecrc.ac.in,3rd,
MOHAMMAD FARHAN,25EJCME013,mohammadfarhan.mech29@jecrc.ac.in,3rd,
NAMAN RAJ,25EJCME015,namanraj.mech29@jecrc.ac.in,3rd,
NIKHIL TANWAR,25EJCME016,nikhiltanwar.mech29@jecrc.ac.in,3rd,
NITIN SINGH SHEKHAWAT,25EJCME017,nitinsinghshekhawat.mech29@jecrc.ac.in,3rd,
PRATHAM VERMA,25EJCME018,prathamverma.mech29@jecrc.ac.in,3rd,
PRINCE KUMAR,25EJCME019,princekumar.mech29@jecrc.ac.in,3rd,
PULKIT SHARMA,25EJCME020,pulkitsharma.mech29@jecrc.ac.in,3rd,
RAGHAV KUMAWAT,25EJCME021,raghavkumawat.mech29@jecrc.ac.in,3rd,
RISHI GUPTA,25EJCME022,rishigupta.mech29@jecrc.ac.in,3rd,
ROHAN GUPTA,25EJCME023,rohangupta.mech29@jecrc.ac.in,3rd,
SHAHJAN KHAN,25EJCME024,shahjankhan.mech29@jecrc.ac.in,3rd,
SHUBHAM KUMAR,25EJCME026,shubhamkumar.mech29@jecrc.ac.in,3rd,
SUMIT JANGID,25EJCME027,sumitjangid.mech29@jecrc.ac.in,3rd,
SURAJ RATHOR,25EJCME028,surajrathor.mech29@jecrc.ac.in,3rd,
TRILOK JANGID,25EJCME029,trilokjangid.mech29@jecrc.ac.in,3rd,
VIJIT SINGH NATHAWAT,25EJCME031,vijitsinghnathawat.mech29@jecrc.ac.in,3rd,
PRIYANSHU PALSANIYA,25EJCME032,priyanshupalsaniya.mech29@jecrc.ac.in,3rd,
TUSHAR GUPTA,25EJCME700,tushargupta.mech29@jecrc.ac.in,3rd,"""

def deduce_branch(roll_no, email):
    r = (roll_no or '').upper()
    e = (email or '').lower()
    if 'IT' in r or '.it' in e:
        return 'IT'
    if 'AD' in r or '.ai' in e:
        return 'AIDS'
    if 'EC' in r or '.ece' in e:
        return 'ECE'
    if 'ME' in r or '.mech' in e:
        return 'ME'
    if 'CS' in r or '.cs' in e:
        return 'CSE'
    return 'General'

def deduce_year(sem):
    s = (sem or '').lower().strip()
    if '3' in s or 'iii' in s:
        return '2'
    if '5' in s or 'v' in s:
        return '3'
    if '1' in s or 'i' in s:
        return '1'
    if '7' in s or 'vii' in s:
        return '4'
    return '2'

def run():
    event, _ = Event.objects.get_or_create(
        title="Art of Happiness",
        defaults={
            'description': 'Art of Happiness Event',
            'start_date': timezone.now().date(),
            'end_date': timezone.now().date(),
            'is_active': True
        }
    )

    AttendanceSession.objects.get_or_create(
        event=event,
        day_label="Day 1",
        defaults={
            'title': "Art of Happiness - Day 1",
            'date': timezone.now().date(),
            'is_active': True
        }
    )

    lines = [line.strip() for line in RAW_CSV.strip().split('\n') if line.strip()]
    data_lines = lines[1:]

    # Pre-fetch existing students and passes for this event in 1 query each
    existing_students = {s.email.lower(): s for s in Student.objects.all()}
    existing_passes = set(EventPass.objects.filter(event=event).values_list('student_id', flat=True))

    new_students_to_create = []
    students_to_update = []
    seen_emails_in_csv = set()

    parsed_rows = []
    for line in data_lines:
        parts = [p.strip() for p in line.split(',')]
        if len(parts) < 3:
            continue
        name = parts[0]
        roll_no = parts[1]
        email = parts[2].replace(' ', '').replace('.ac in', '.ac.in').lower()
        sem = parts[3] if len(parts) > 3 else '3rd'
        section = parts[4] if len(parts) > 4 else ''

        if not name or not email or '@' not in email or email in seen_emails_in_csv:
            continue
        seen_emails_in_csv.add(email)

        branch = deduce_branch(roll_no, email)
        year = deduce_year(sem)
        parsed_rows.append({
            'name': name.title(),
            'email': email,
            'branch': branch,
            'year': year,
            'section': section
        })

    for row in parsed_rows:
        em = row['email']
        if em in existing_students:
            s = existing_students[em]
            s.name = row['name']
            s.branch = row['branch']
            s.year = row['year']
            s.section = row['section']
            students_to_update.append(s)
        else:
            new_students_to_create.append(Student(
                unique_token=uuid.uuid4(),
                name=row['name'],
                email=row['email'],
                branch=row['branch'],
                year=row['year'],
                section=row['section']
            ))

    if students_to_update:
        print(f"Bulk updating sections for {len(students_to_update)} students...")
        Student.objects.bulk_update(students_to_update, ['section', 'branch', 'year'], batch_size=100)
        print("Updated student sections.")

    if new_students_to_create:
        print(f"Bulk creating {len(new_students_to_create)} new students...")
        Student.objects.bulk_create(new_students_to_create, batch_size=100)
        print("Created students.")

    # Re-fetch all students in parsed_rows to create EventPass
    all_students_map = {s.email.lower(): s for s in Student.objects.filter(email__in=[r['email'] for r in parsed_rows])}

    passes_to_create = []
    for row in parsed_rows:
        s = all_students_map.get(row['email'])
        if s and s.id not in existing_passes:
            passes_to_create.append(EventPass(
                event=event,
                student=s,
                event_token=uuid.uuid4()
            ))

    if passes_to_create:
        print(f"Bulk creating {len(passes_to_create)} event passes...")
        EventPass.objects.bulk_create(passes_to_create, batch_size=100)
        print("Created event passes.")

    total_enrolled = EventPass.objects.filter(event=event).count()
    print(f"SUCCESS! Total enrolled in '{event.title}': {total_enrolled}")

if __name__ == '__main__':
    run()
