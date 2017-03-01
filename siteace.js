Websites = new Mongo.Collection("websites");

var WebsitesIndex = new EasySearch.Index({
	collection: Websites,
	fields: ['title', 'description'],
	engine: new EasySearch.Minimongo({
		sort: function(){
			return {upVotes:-1, downVotes:-1, createOn:-1};
		}
	})
});

if (Meteor.isClient) {

	/// routing 

	Router.configure({
	  layoutTemplate: 'ApplicationLayout'
	});

	
	Router.route('/', function () {
	  this.render('navbar', {
	    to:"navbar"
	  });
	  this.render('siteList', {
	    to:"main"
	  });
	  this.render('comments_list', {
    to: 'comments'
	});
	this.render('comment_form', {
	    to: 'comment'
	});
	});

	Router.route('/:_id', function () {
	  this.render('navbar', {
	    to:"navbar"
	  });
	  this.render('website_item', {
	    to:"main", 
	    data:function(){
	      return Images.findOne({_id:this.params._id});
	    }
	  });
	});



	/////
	//building search function
	///
	Template.navbar.helpers({
		websitesIndex: function (){
			return WebsitesIndex;
		}
	});


	/////
	// template helpers 
	/////

	// helper function that returns all available websites
	Template.website_list.helpers({
		websites:function(){
			return Websites.find({}, {sort: {up:-1}});
		}
	});


	/// accounts config

	Accounts.ui.config({
	passwordSignupFields: "USERNAME_AND_EMAIL"
	});


	// format the date
	Template.registerHelper('formattedDate', function() {
	     return moment(this.createdOn).format("DD/MM/YYYY"); 
	});

	Template.registerHelper('getUser', function(userId) {
     var user = Meteor.users.findOne({_id: userId});
    if (user) {
        return user.username;
    }
    else {
        return "anonymous";
    }
	});

	/////
	// template events 
	/////



	Template.website_item.events({
		"click .js-upvote":function(event){
			// example of how you can access the id for the website in the database
			// (this is the data context for the template)
			var website_id = this._id;
			console.log("Up voting website with id "+website_id);
			// put the code in here to add a vote to a website!
			Websites.update({_id:website_id},
							 {$set: {up: this.up +1}});

			return false;// prevent the button from reloading the page
		}, 
		"click .js-downvote":function(event){

			// example of how you can access the id for the website in the database
			// (this is the data context for the template)
			var website_id = this._id;
			console.log("Down voting website with id "+website_id);

			// put the code in here to remove a vote from a website!
			Websites.update({_id:website_id},
							 {$set: {up: this.down +1}});
			return false;// prevent the button from reloading the page
		}
	}),

	Template.website_form.events({
		"click .js-toggle-website-form":function(event){
			$("#website_form").toggle('slow');
		}, 

		//pull website information
		"blur #url":function(event){
			console.log("event blur captured");
			var url = "http://" + event.currentTarget.value;
			console.log("URL is: "+url);
			  Meteor.call("check_webpage", url, function(error, response) {
            if (error) {
                console.log(error);
            } else {
                page = "<div>" + response.content + "</div>";
                var title = $("title", page).text();
                var description = $("meta[name='description']", page).attr("content");
                console.log(title);
                console.log(description);

                if (Meteor.user()) {
                    Websites.insert({
                        url: url,
                        title: title,
                        description: description,
                        createdOn: new Date(),
                        createdBy:Meteor.user()._id,
                        upvotes: 0,
                        downvotes: 0,
                        comments: []
                    });
                    console.log("Added site with url " + url);
                } else {
                    alert("You must login to add a site!");
                }
            }
        });
 
		}, // end of blur event


		"submit .js-save-website-form":function(event){
			var url, title, description;
			
			// here is an example of how to get the url out of the form:
			url = event.target.url.value;
			title = event.target.title.value;
			description = event.target.description.value;
			console.log("The url they entered is: "+url+" description is: "+description);

			//  put your website saving code in here!	
			if (Meteor.user()){
				$("#website_form").toggle('slow');
				Websites.insert({
					url:url, 
					title:title,
					description:description,
					createdOn: new Date(),
					createdBy:Meteor.user()._id

				});
			}
			return false;// stop the form submit from reloading the page

		}
	});

	Template.comment_form.events({
    "submit .js-save-comment-form":function(event){

        if (Meteor.user()) {

            // here is an example of how to get the comment out of the form:
            var comment = event.target.comment.value;
            console.log("The comment they entered is: "+comment);

            Comments.insert({
                website: Router.current().params._id, 
                comment: comment, 
                createdOn: new Date(),
                user: Meteor.user().username
            });
        }
        else {
            alert('You need to be logged in to submit comments!');
        }

        return false; // stop the form submit from reloading the page

    }
	});

	Template.comments_list.helpers({
    comments:function(){
        return Comments.find({website: Router.current().params._id});
    }
	});

	Meteor.methods({
		requestWebsite:function(url){
			try {
				console.log("making the request to "+url);
				var result = HTTP.get(url, {followRedirects:true});
				console.log("Request to "+url+" returned successfully!");
				var cheerio = Meteor.npmRequire('cheerio');
				$ = cheerio.load(result.content);
				var answer = {};
				answer["title"] = $("title").text();
				answer["description"] = $('meta[name=description]').prop('content');
				console.log("Title: " + answer["title"]);
				console.log("Description: " + answer["description"]);
				return answer;
			} catch (e) {
				console.error('Request returned error: ', e);
			}
		} // end requestWebsite
	});



}


if (Meteor.isServer) {
	//pulling website form the server
	Meteor.methods({
    check_webpage: function(url) {
        this.unblock();
        return Meteor.http.get(url, {"npmRequestOptions" : {"gzip" : true}});
    }
	});

	//search function
	
  Meteor.startup(function () {
    // code to run on server at startup
    if (!Websites.findOne()){
    	console.log("No websites yet. Creating starter data.");
    	  Websites.insert({
    		title:"Goldsmiths Computing Department", 
    		url:"http://www.gold.ac.uk/computing/", 
    		description:"This is where this course was developed.", 
    		createdOn:new Date(),
    		user:"Anonymous",
    		up:0,
    		down:0
    	});
    	 Websites.insert({
    		title:"University of London", 
    		url:"http://www.londoninternational.ac.uk/courses/undergraduate/goldsmiths/bsc-creative-computing-bsc-diploma-work-entry-route", 
    		description:"University of London International Programme.", 
    		createdOn:new Date(),
    		user:"Anonymous",
    		up:0,
    		down:0
    	});
    	 Websites.insert({
    		title:"Coursera", 
    		url:"http://www.coursera.org", 
    		description:"Universal access to the world’s best education.", 
    		createdOn:new Date(),
    		user:"Anonymous",
    		up:0,
    		down:0
    	});
    	Websites.insert({
    		title:"Google", 
    		url:"http://www.google.com", 
    		description:"Popular search engine.", 
    		createdOn:new Date(),
    		user:"Anonymous",
    		up:0,
    		down:0
    	});
    }
  });
}
