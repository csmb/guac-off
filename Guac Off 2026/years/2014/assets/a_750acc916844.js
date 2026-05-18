var domainname = window.location.hostname;
var google_afd_request = {
    client: 'ca-dp-oversee_ncd',
    domain_name: domainname,
    referrer: document.referrer,
    session_token: 'create'
};
var param_name = '';
var param_value = '';
var frame;
var drid;

var registrar_frameset = function(params) {
    drid = params['drid'];
    if (params['a_id']) {
        param_name = 'a_id';
    }
    else if (params['o_id']) {
        param_name = 'o_id';
    }
    param_value = params[param_name];
    frame = document.getElementById(params['frame']);

    google_afd_request['drid'] = params['drid'];

    if (!frame) {
        document.write('<title>' + domainname + '</title>\n');
        document.write('<meta name="keywords" content="' + domainname + '">\n');
        document.write('<meta name="description" content="' + domainname + '">\n');
    }

    var token_url = 'http://pagead2.googlesyndication.com/apps/domainpark/show_afd_ads.js';
    document.write('<script type="text/javascript" language="JavaScript" ' +
                   'src="' + token_url + '"></' + 'script>\n');
}

function google_afd_ad_request_done(response) {
    var server = 'dsregredir.com';
    var url = 'http://' + server + '/?domainname=' + domainname +
              '&drid=' + drid +
              (param_name ? ('&' + param_name + '=' + param_value) : '') +
              '&session_token=' + response.session_token;
    if (frame) {
        frame.name = domainname;
        frame.src = url;
    }
    else {
        document.write('<frameset rows="100%,*" frameborder="no" border="0" framespacing="0"><frame name="'
                       + domainname + '" src="' + url + '"/></frameset>');
    }
}
